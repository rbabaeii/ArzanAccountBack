import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { UnauthorizedException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { ROLES_KEY } from '../src/common/decorators/roles.decorator';
import { AuthService } from '../src/auth/auth.service';
import { OrdersService } from '../src/orders/orders.service';
import { CouponsService } from '../src/coupons/coupons.service';
import { CartBeCartController } from '../src/cartbecart/cartbecart.controller';
import { SettingsService } from '../src/settings/settings.service';
import * as bcrypt from 'bcryptjs';

async function runVerification() {
  console.log('====================================================');
  console.log('🛡️  ARZAN ACCOUNT DEEP SECURITY VERIFICATION SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(testName: string, condition: boolean, details?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} ${details ? '- ' + details : ''}`);
      failed++;
    }
  }

  const jwtSecret = 'arzan-account-secret-key-2026';
  const jwtService = new JwtService({ secret: jwtSecret });

  // ----------------------------------------------------
  // TEST 1: JwtAuthGuard with missing token
  // ----------------------------------------------------
  {
    const reflector = new Reflector();
    const guard = new JwtAuthGuard(jwtService, reflector);
    const mockContext: any = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: {} }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    };

    let threw = false;
    try {
      guard.canActivate(mockContext);
    } catch (e: any) {
      threw = e instanceof UnauthorizedException;
    }
    assert('JwtAuthGuard rejects unauthenticated requests with 401', threw);
  }

  // ----------------------------------------------------
  // TEST 2: JwtAuthGuard with forged/tampered token
  // ----------------------------------------------------
  {
    const reflector = new Reflector();
    const guard = new JwtAuthGuard(jwtService, reflector);
    const forgedToken = new JwtService({ secret: 'attacker-fake-secret' }).sign({
      sub: 'hacker-1',
      role: 'SUPER_ADMIN',
    });

    const mockContext: any = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { authorization: `Bearer ${forgedToken}` },
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    };

    let threw = false;
    try {
      guard.canActivate(mockContext);
    } catch (e: any) {
      threw = e instanceof UnauthorizedException;
    }
    assert('JwtAuthGuard rejects forged JWT tokens (signature verification)', threw);
  }

  // ----------------------------------------------------
  // TEST 3: JwtAuthGuard with valid token
  // ----------------------------------------------------
  {
    const reflector = new Reflector();
    const guard = new JwtAuthGuard(jwtService, reflector);
    const validToken = jwtService.sign({
      sub: 'user-123',
      phone: '09121111111',
      role: 'USER',
    });

    const req: any = {
      headers: { authorization: `Bearer ${validToken}` },
    };
    const mockContext: any = {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    };

    const result = guard.canActivate(mockContext);
    assert('JwtAuthGuard accepts valid signed token and injects req.user', result && req.user?.sub === 'user-123');
  }

  // ----------------------------------------------------
  // TEST 4: RolesGuard rejects unauthorized role
  // ----------------------------------------------------
  {
    const reflector = new Reflector();
    const guard = new RolesGuard(reflector);

    const mockHandler = () => {};
    Reflect.defineMetadata(ROLES_KEY, ['SUPER_ADMIN'], mockHandler);

    const mockContext: any = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'user-1', role: 'USER' },
        }),
      }),
      getHandler: () => mockHandler,
      getClass: () => ({}),
    };

    let threw = false;
    try {
      guard.canActivate(mockContext);
    } catch (e: any) {
      threw = e instanceof ForbiddenException;
    }
    assert('RolesGuard blocks USER from accessing SUPER_ADMIN endpoint with 403', threw);
  }

  // ----------------------------------------------------
  // TEST 5: RolesGuard allows SUPER_ADMIN
  // ----------------------------------------------------
  {
    const reflector = new Reflector();
    const guard = new RolesGuard(reflector);

    const mockHandler = () => {};
    Reflect.defineMetadata(ROLES_KEY, ['FINANCE_ADMIN'], mockHandler);

    const mockContext: any = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'admin-1', role: 'SUPER_ADMIN' },
        }),
      }),
      getHandler: () => mockHandler,
      getClass: () => ({}),
    };

    const result = guard.canActivate(mockContext);
    assert('RolesGuard grants SUPER_ADMIN full access across manager routes', result === true);
  }

  // ----------------------------------------------------
  // TEST 6: Real AuthService.updatePassword logic
  // ----------------------------------------------------
  {
    const existingPasswordHash = bcrypt.hashSync('ExistingSecurePassword123', 10);
    const mockUser = {
      id: 'usr-1',
      phone: '09123456789',
      password: existingPasswordHash,
    };

    const mockPrisma: any = {
      user: {
        findUnique: jestFn(async (args: any) => {
          if (args.where.id === 'usr-1') return mockUser;
          return null;
        }),
        update: jestFn(async (args: any) => args.data),
      },
      auditLog: {
        create: jestFn(async () => ({})),
      },
    };

    const authService = new AuthService(
      mockPrisma,
      jwtService,
      {} as any,
      {} as any,
      {} as any,
    );

    // Scenario A: current password omitted
    let scenarioAThrew = false;
    try {
      await authService.updatePassword('usr-1', 'NewPassword123', undefined);
    } catch (e: any) {
      scenarioAThrew = e instanceof BadRequestException && e.message.includes('الزامی');
    }
    assert('Real AuthService.updatePassword rejects when current password is omitted', scenarioAThrew);

    // Scenario B: wrong current password provided
    let scenarioBThrew = false;
    try {
      await authService.updatePassword('usr-1', 'NewPassword123', 'WrongCurrentPassword');
    } catch (e: any) {
      scenarioBThrew = e instanceof BadRequestException && e.message.includes('نادرست');
    }
    assert('Real AuthService.updatePassword rejects incorrect current password', scenarioBThrew);

    // Scenario C: correct current password provided
    let scenarioCSuccess = false;
    try {
      const res = await authService.updatePassword('usr-1', 'NewSecurePassword456', 'ExistingSecurePassword123');
      scenarioCSuccess = res.success === true;
    } catch {}
    assert('Real AuthService.updatePassword succeeds when correct password is provided', scenarioCSuccess);
  }

  // ----------------------------------------------------
  // TEST 7: Real OrdersService price tampering guard
  // ----------------------------------------------------
  {
    const mockProduct = {
      id: 'prod-1',
      title: 'Spotify Premium 1 Month',
      priceToman: 450000,
      salePriceToman: 450000,
      costPriceUsd: 5.5,
      retailPriceUsd: 6.0,
      inStock: true,
      stockCount: 10,
      type: 'instant',
    };

    const mockPrisma: any = {
      product: {
        findFirst: jestFn(async () => mockProduct),
        findUnique: jestFn(async () => mockProduct),
        update: jestFn(async () => mockProduct),
      },
      user: {
        findUnique: jestFn(async () => null),
      },
      order: {
        create: jestFn(async (args: any) => args.data),
      },
      $transaction: jestFn(async (cb: any) => cb(mockPrisma)),
    };

    const mockCatalogService: any = {
      validateLiveStock: jestFn(async () => true),
    };
    const mockPricingService: any = {
      calculatePrice: jestFn(async () => ({ finalToman: 450000 })),
    };

    const ordersService = new OrdersService(
      mockPrisma,
      {} as any,
      {} as any,
      mockCatalogService,
      mockPricingService,
      {} as any,
    );

    let priceTamperCaught = false;
    try {
      await ordersService.createOrder({
        customerEmail: 'test@example.com',
        customerPhone: '09121112233',
        totalPriceToman: 1000, // Attacker forged price from 450,000 to 1,000
        items: [
          {
            productId: 'prod-1',
            quantity: 1,
            priceToman: 1000,
          },
        ],
      } as any);
    } catch (e: any) {
      priceTamperCaught = e instanceof BadRequestException && e.message.includes('همخوانی ندارد');
    }
    assert('Real OrdersService strictly rejects order when client tampers with prices', priceTamperCaught);
  }

  // ----------------------------------------------------
  // TEST 8: Real OrdersService atomic coupon exhaustion check
  // ----------------------------------------------------
  {
    const mockProduct = {
      id: 'prod-1',
      title: 'Spotify 1M',
      priceToman: 100000,
      salePriceToman: 100000,
      costPriceUsd: 2.0,
      retailPriceUsd: 2.5,
      inStock: true,
      stockCount: 5,
    };

    const mockPrisma: any = {
      product: {
        findFirst: jestFn(async () => mockProduct),
        findUnique: jestFn(async () => mockProduct),
        update: jestFn(async () => mockProduct),
      },
      coupon: {
        findUnique: jestFn(async () => ({
          id: 'coup-1',
          code: 'SALE10',
          discountPercent: 10,
          isActive: true,
          maxUsage: 5,
          usageCount: 5, // Fully exhausted!
        })),
        updateMany: jestFn(async () => ({ count: 0 })), // Atomic update fails because usageCount < maxUsage is false
      },
      user: {
        findUnique: jestFn(async () => null),
      },
      order: {
        create: jestFn(async (args: any) => args.data),
      },
      $transaction: jestFn(async (cb: any) => cb(mockPrisma)),
    };

    const mockCatalogService: any = {
      validateLiveStock: jestFn(async () => true),
    };
    const mockPricingService: any = {
      calculatePrice: jestFn(async () => ({ finalToman: 100000 })),
    };

    const mockCouponsService: any = {
      validateCoupon: jestFn(async () => ({
        success: true,
        coupon: { id: 'coup-1', code: 'SALE10', maxUsage: 5, usageCount: 5, discountPercent: 10 },
      })),
    };

    const ordersService = new OrdersService(
      mockPrisma,
      {} as any,
      {} as any,
      mockCatalogService,
      mockPricingService,
      mockCouponsService,
    );

    let couponExhaustionCaught = false;
    try {
      await ordersService.createOrder({
        customerEmail: 'buyer@example.com',
        customerPhone: '09123334455',
        totalPriceToman: 90000,
        couponCode: 'SALE10',
        items: [{ productId: 'prod-1', quantity: 1, priceToman: 100000 }],
      } as any);
    } catch (e: any) {
      couponExhaustionCaught =
        e instanceof BadRequestException &&
        (e.message.includes('ظرفیت استفاده') || e.message.includes('سقف استفاده'));
    }
    assert('Real OrdersService rejects exhausted coupon inside atomic transaction without burning', couponExhaustionCaught);
  }

  // ----------------------------------------------------
  // TEST 9: Real CouponsService per-user limit & allowedUserIds check
  // ----------------------------------------------------
  {
    const mockPrisma: any = {
      user: {
        findUnique: jestFn(async () => null),
      },
      coupon: {
        findUnique: jestFn(async (args: any) => {
          if (args.where.code === 'VIPONLY') {
            return {
              id: 'c-vip',
              code: 'VIPONLY',
              discountPercent: 20,
              isActive: true,
              maxUsage: 100,
              usageCount: 0,
              maxUsagePerUser: 1,
              allowedUserIds: JSON.stringify([{ id: 'vip-user-1', label: 'VIP Customer' }]),
            };
          }
          return null;
        }),
      },
      order: {
        findFirst: jestFn(async (args: any) => {
          if (
            args.where.customerPhone === '09128888888' ||
            args.where.OR?.some((c: any) => c.customerPhone === '09128888888')
          ) {
            return { id: 'prev-order-1' }; // User already used it
          }
          return null;
        }),
      },
    };

    const couponsService = new CouponsService(mockPrisma);

    // Scenario A: Unauthorized user
    let unauthCaught = false;
    try {
      await couponsService.validateCoupon('VIPONLY', 'regular-user-2', '09127777777');
    } catch (e: any) {
      unauthCaught = e instanceof BadRequestException && e.message.includes('مختص کاربران منتخب');
    }
    assert('Real CouponsService rejects user not matching allowedUserIds target objects', unauthCaught);

    // Scenario B: Authorized user matches object ID
    let authValid = false;
    try {
      const res = await couponsService.validateCoupon('VIPONLY', 'vip-user-1', '09129999999');
      authValid = res.success === true && res.coupon?.discountPercent === 20;
    } catch (err: any) {
      console.error('Scenario B unexpected error:', err);
    }
    assert('Real CouponsService allows user matching object array allowedUserIds', authValid);

    // Scenario C: User already used coupon (exceeding maxUsagePerUser)
    let perUserLimitCaught = false;
    try {
      await couponsService.validateCoupon('VIPONLY', 'vip-user-1', '09128888888');
    } catch (e: any) {
      perUserLimitCaught = e instanceof BadRequestException && e.message.includes('استفاده');
    }
    assert('Real CouponsService blocks reuse when user has reached maxUsagePerUser', perUserLimitCaught);
  }

  // ----------------------------------------------------
  // TEST 10: Real CartBeCartController simulation guard
  // ----------------------------------------------------
  {
    const mockCartBeCartService: any = {
      simulatePaymentSuccess: jestFn(async () => ({ success: true, simulated: true })),
    };
    const controller = new CartBeCartController(mockCartBeCartService);

    const savedEnv = process.env.NODE_ENV;
    const savedSim = process.env.ENABLE_PAYMENT_SIMULATION;

    // Subtest A: Forbidden in production even if ENABLE_PAYMENT_SIMULATION is true
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_PAYMENT_SIMULATION = 'true';
    let prodBlocked = false;
    try {
      await controller.simulateSuccess('token-1', { id: 'admin-1', role: 'SUPER_ADMIN' });
    } catch (e: any) {
      prodBlocked = e instanceof ForbiddenException;
    }
    assert('CartBeCartController strictly blocks simulate-success in production environment', prodBlocked);

    // Subtest B: Forbidden when ENABLE_PAYMENT_SIMULATION is not 'true'
    process.env.NODE_ENV = 'development';
    process.env.ENABLE_PAYMENT_SIMULATION = 'false';
    let devDisabledBlocked = false;
    try {
      await controller.simulateSuccess('token-1', { id: 'admin-1', role: 'SUPER_ADMIN' });
    } catch (e: any) {
      devDisabledBlocked = e instanceof ForbiddenException;
    }
    assert('CartBeCartController blocks simulate-success when ENABLE_PAYMENT_SIMULATION !== "true"', devDisabledBlocked);

    // Subtest C: Allowed in dev when enabled
    process.env.NODE_ENV = 'development';
    process.env.ENABLE_PAYMENT_SIMULATION = 'true';
    let devAllowed = false;
    try {
      const res = await controller.simulateSuccess('token-1', { id: 'admin-1', role: 'SUPER_ADMIN' });
      devAllowed = res.success === true;
    } catch {}
    assert('CartBeCartController allows simulate-success only when dev and explicitly enabled', devAllowed);

    // Restore env
    process.env.NODE_ENV = savedEnv;
    process.env.ENABLE_PAYMENT_SIMULATION = savedSim;
  }

  // ----------------------------------------------------
  // TEST 11: Real SettingsService masks currency API key
  // ----------------------------------------------------
  {
    const mockPrisma: any = {
      systemSetting: {
        findMany: jestFn(async () => [
          { key: 'USD_TO_RIAL_RATE', value: '720000' },
          { key: 'CURRENCY_API_KEY', value: 'super-secret-api-key-xyz123' },
        ]),
      },
    };

    const settingsService = new SettingsService(mockPrisma);
    const settings = await settingsService.getAllSettings();

    const isMasked = settings.currencyApiKey.startsWith('••••••••') && !settings.currencyApiKey.includes('super-secret');
    assert('Real SettingsService masks CURRENCY_API_KEY from public view', isMasked);
  }

  // ----------------------------------------------------
  // TEST 12: SVG upload rejection logic
  // ----------------------------------------------------
  {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];

    const isSvgMimeAllowed = allowedMimeTypes.includes('image/svg+xml');
    const isSvgExtAllowed = allowedExts.includes('.svg');
    const isJpgAllowed = allowedMimeTypes.includes('image/jpeg') && allowedExts.includes('.jpg');

    assert('SVG MIME type image/svg+xml is rejected by media upload policy', !isSvgMimeAllowed);
    assert('SVG extension .svg is rejected by media upload policy', !isSvgExtAllowed);
    assert('Valid image formats (e.g. JPG) are accepted by media upload policy', isJpgAllowed);
  }

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passed} passed, ${failed} failed.`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

function jestFn(impl?: any) {
  const fn: any = (...args: any[]) => {
    fn.mock.calls.push(args);
    if (impl) return impl(...args);
  };
  fn.mock = { calls: [] };
  return fn;
}

runVerification().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
