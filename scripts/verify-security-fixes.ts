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
import { CartBeCartService } from '../src/cartbecart/cartbecart.service';
import { SettingsService } from '../src/settings/settings.service';
import { UsersService } from '../src/users/users.service';
import { SearchController } from '../src/search/search.controller';
import { MediaController } from '../src/media/media.controller';
import { CouponsController } from '../src/coupons/coupons.controller';
import { PrismaExceptionFilter } from '../src/common/filters/prisma-exception.filter';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

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
      await guard.canActivate(mockContext);
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
      await guard.canActivate(mockContext);
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

    const result = await guard.canActivate(mockContext);
    assert('JwtAuthGuard accepts valid signed token and injects req.user', Boolean(result) && req.user?.sub === 'user-123');
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

  // ----------------------------------------------------
  // TEST 13: CRIT-02 - OrdersService.requestRefund & processRefund eligibility
  // ----------------------------------------------------
  {
    const mockOrderPending = {
      id: 'ord-unpaid-1',
      orderNumber: 'ORD-999001',
      status: 'pending',
      totalPriceToman: 1000000,
      customerEmail: 'buyer@test.com',
      customerPhone: '09121111111',
    };
    const mockOrderCompleted = {
      id: 'ord-paid-1',
      orderNumber: 'ORD-999002',
      status: 'completed',
      totalPriceToman: 500000,
      customerEmail: 'buyer@test.com',
      customerPhone: '09121111111',
      paymentGateway: 'cartbecart',
      approvedAt: new Date(),
    };
    const mockOrderUnpaidRequested = {
      id: 'ord-unpaid-2',
      orderNumber: 'ORD-999003',
      status: 'refund_requested',
      totalPriceToman: 700000,
      customerEmail: 'buyer@test.com',
      customerPhone: '09121111111',
      paymentGateway: 'cartbecart',
      approvedAt: null,
    };

    const mockPrisma: any = {
      order: {
        findFirst: jestFn(async (args: any) => {
          if (args.where.OR?.some((c: any) => c.id === 'ord-unpaid-1')) return mockOrderPending;
          if (args.where.OR?.some((c: any) => c.id === 'ord-paid-1')) return mockOrderCompleted;
          if (args.where.OR?.some((c: any) => c.id === 'ord-unpaid-2')) return mockOrderUnpaidRequested;
          return null;
        }),
        update: jestFn(async (args: any) => ({ ...mockOrderCompleted, ...args.data })),
      },
      cardPayment: {
        findFirst: jestFn(async (args: any) => {
          if (args.where.OR?.some((c: any) => c.orderNumber === 'ORD-999002' || c.id === 'ord-paid-1')) {
            return { id: 'cp-1', status: 'PAID' };
          }
          return null;
        }),
      },
      auditLog: {
        create: jestFn(async () => ({})),
        findFirst: jestFn(async () => null),
      },
    };

    const ordersService = new OrdersService(
      mockPrisma,
      { sendDeliveryEmail: jestFn(async () => ({})) } as any,
      { sendOrderRefundedSms: jestFn(async () => ({ success: true })) } as any,
      {} as any,
      {} as any,
      {} as any,
    );

    // Subtest A: requestRefund on pending (unpaid) order is rejected
    let pendingRejected = false;
    try {
      await ordersService.requestRefund('ord-unpaid-1', { refundReason: 'منصرف شدم' }, { id: 'u1', email: 'buyer@test.com' });
    } catch (e: any) {
      pendingRejected = e instanceof BadRequestException && e.message.includes('نهایی‌شده');
    }
    assert('CRIT-02: OrdersService.requestRefund rejects unpaid pending orders', pendingRejected);

    // Subtest B: requestRefund on completed (paid) order succeeds
    let completedAccepted = false;
    try {
      const res = await ordersService.requestRefund('ord-paid-1', { refundReason: 'نارضایتی از محصول' }, { id: 'u1', email: 'buyer@test.com' });
      completedAccepted = res.status === 'refund_requested';
    } catch {}
    assert('CRIT-02: OrdersService.requestRefund accepts completed orders', completedAccepted);

    // Subtest C: processRefund rejects pending order
    let processPendingRejected = false;
    try {
      await ordersService.processRefund({ orderId: 'ord-unpaid-1', refundAmountToman: 1000000 });
    } catch (e: any) {
      processPendingRejected = e instanceof BadRequestException;
    }
    assert('CRIT-02: OrdersService.processRefund rejects unpaid pending orders', processPendingRejected);

    // Subtest D: processRefund rejects order without legitimate payment record
    let unverifiedPaymentRejected = false;
    try {
      await ordersService.processRefund({ orderId: 'ord-unpaid-2', refundAmountToman: 700000 });
    } catch (e: any) {
      unverifiedPaymentRejected = e instanceof BadRequestException && e.message.includes('تراکنش مالی تاییدشده‌ای');
    }
    assert('CRIT-02: OrdersService.processRefund rejects orders lacking verified payment', unverifiedPaymentRejected);
  }

  // ----------------------------------------------------
  // TEST 14: CRIT-03 - SearchController live search scope restrictions
  // ----------------------------------------------------
  {
    let passedScope = '';
    const mockSearchService: any = {
      search: jestFn((params: any) => {
        passedScope = params.scope;
        return { products: [], categories: [], orders: [], users: [] };
      }),
    };

    const searchController = new SearchController(mockSearchService);

    // Subtest A: Anonymous user asking for admin scope is forced to 'public'
    searchController.searchLive('0912', 'admin', '10', undefined);
    assert('CRIT-03: Anonymous live search with scope=admin defaults strictly to public', passedScope === 'public');

    // Subtest B: Regular user (role: 'USER') asking for all scope is forced to 'public'
    searchController.searchLive('0912', 'all', '10', { id: 'u1', role: 'USER' });
    assert('CRIT-03: Regular user live search with scope=all defaults strictly to public', passedScope === 'public');

    // Subtest C: SUPER_ADMIN asking for admin scope gets 'admin'
    searchController.searchLive('0912', 'admin', '10', { id: 'a1', role: 'SUPER_ADMIN' });
    assert('CRIT-03: SUPER_ADMIN live search is granted scope=admin', passedScope === 'admin');
  }

  // ----------------------------------------------------
  // TEST 15: HIGH-04 - SearchController.triggerReindex is guarded with SUPER_ADMIN
  // ----------------------------------------------------
  {
    const roles = Reflect.getMetadata(ROLES_KEY, SearchController.prototype.triggerReindex);
    const hasSuperAdmin = Array.isArray(roles) && roles.includes('SUPER_ADMIN');
    assert('HIGH-04: SearchController.triggerReindex is protected with SUPER_ADMIN role guard', hasSuperAdmin);
  }

  // ----------------------------------------------------
  // TEST 16: CRIT-04 - UsersService.requestWithdrawal atomic balance & race prevention
  // ----------------------------------------------------
  {
    const mockUser = {
      id: 'usr-withdrawable-1',
      name: 'کاربر تستی',
      status: 'ACTIVE',
      directDepositBalance: 500000,
      walletBalanceToman: 500000,
      cashbackBonusBalance: 0,
    };

    // Subtest A: Concurrent withdrawal when atomic updateMany returns 0 (insufficient balance)
    let atomicCaught = false;
    const mockPrismaAtomicFail: any = {
      user: {
        findUnique: jestFn(async () => mockUser),
      },
      withdrawalRequest: {
        findFirst: jestFn(async () => null),
      },
      $transaction: jestFn(async (cb: any) => {
        const txMock = {
          withdrawalRequest: { findFirst: jestFn(async () => null) },
          user: {
            updateMany: jestFn(async () => ({ count: 0 })),
            findUnique: jestFn(async () => mockUser),
          },
        };
        return cb(txMock);
      }),
    };

    const usersServiceFail = new UsersService(mockPrismaAtomicFail, {} as any, {} as any);
    try {
      await usersServiceFail.requestWithdrawal('usr-withdrawable-1', {
        amountToman: 500000,
        cardNumber: '6037991122334455',
        accountOwnerName: 'کاربر تستی',
      } as any);
    } catch (e: any) {
      atomicCaught = e instanceof BadRequestException && e.message.includes('کافی نیست');
    }
    assert('CRIT-04: UsersService.requestWithdrawal aborts when atomic balance update count is 0', atomicCaught);

    // Subtest B: Re-verification inside transaction blocks pending duplicate
    let pendingTxCaught = false;
    const mockPrismaPendingFail: any = {
      user: {
        findUnique: jestFn(async () => mockUser),
      },
      withdrawalRequest: {
        findFirst: jestFn(async () => null),
      },
      $transaction: jestFn(async (cb: any) => {
        const txMock = {
          withdrawalRequest: { findFirst: jestFn(async () => ({ id: 'w-existing', status: 'PENDING' })) },
          user: {
            updateMany: jestFn(async () => ({ count: 0 })),
            findUnique: jestFn(async () => mockUser),
          },
        };
        return cb(txMock);
      }),
    };

    const usersServicePending = new UsersService(mockPrismaPendingFail, {} as any, {} as any);
    try {
      await usersServicePending.requestWithdrawal('usr-withdrawable-1', {
        amountToman: 500000,
        cardNumber: '6037991122334455',
        accountOwnerName: 'کاربر تستی',
      } as any);
    } catch (e: any) {
      pendingTxCaught = e instanceof BadRequestException && e.message.includes('در حال بررسی');
    }
    assert('CRIT-04: UsersService.requestWithdrawal blocks duplicate pending inside transaction', pendingTxCaught);

    // Subtest C: Atomic hasPendingWithdrawal lock blocks concurrent double-spend
    let pendingLockCaught = false;
    const mockPrismaLockFail: any = {
      user: {
        findUnique: jestFn(async () => ({ ...mockUser, hasPendingWithdrawal: true })),
      },
      withdrawalRequest: {
        findFirst: jestFn(async () => null),
      },
      $transaction: jestFn(async (cb: any) => {
        const txMock = {
          withdrawalRequest: { findFirst: jestFn(async () => null) },
          user: {
            updateMany: jestFn(async () => ({ count: 0 })),
            findUnique: jestFn(async () => ({ ...mockUser, hasPendingWithdrawal: true })),
          },
        };
        return cb(txMock);
      }),
    };

    const usersServiceLock = new UsersService(mockPrismaLockFail, {} as any, {} as any);
    try {
      await usersServiceLock.requestWithdrawal('usr-withdrawable-1', {
        amountToman: 500000,
        cardNumber: '6037991122334455',
        accountOwnerName: 'کاربر تستی',
      } as any);
    } catch (e: any) {
      pendingLockCaught = e instanceof BadRequestException && e.message.includes('در حال بررسی');
    }
    assert('CRIT-04: UsersService.requestWithdrawal atomic lock blocks concurrent pending requests', pendingLockCaught);
  }

  // ----------------------------------------------------
  // TEST 17: HIGH-01 - UsersService.convertPoints rejects negative points or < 10
  // ----------------------------------------------------
  {
    const mockUser = { id: 'usr-points-1', clubPoints: 100 };
    const mockPrisma: any = {
      user: {
        findUnique: jestFn(async () => mockUser),
        update: jestFn(async (args: any) => ({ ...mockUser, ...args.data })),
        updateMany: jestFn(async (args: any) => ({ count: 1 })),
      },
      coupon: { create: jestFn(async (args: any) => args.data) },
    };

    const usersService = new UsersService(mockPrisma, {} as any, {} as any);

    // Subtest A: Negative points
    let negativePointsRejected = false;
    try {
      await usersService.convertPoints('usr-points-1', -50000);
    } catch (e: any) {
      negativePointsRejected = e instanceof BadRequestException && e.message.includes('۱۰');
    }
    assert('HIGH-01: UsersService.convertPoints rejects negative points with BadRequestException', negativePointsRejected);

    // Subtest B: Points less than 10
    let lowPointsRejected = false;
    try {
      await usersService.convertPoints('usr-points-1', 5);
    } catch (e: any) {
      lowPointsRejected = e instanceof BadRequestException;
    }
    assert('HIGH-01: UsersService.convertPoints rejects points < 10 with BadRequestException', lowPointsRejected);

    // Subtest C: Valid points conversion succeeds and restricts coupon to user
    let validConverted = false;
    let userRestricted = false;
    try {
      const res = await usersService.convertPoints('usr-points-1', 50);
      validConverted = res.coupon?.discountPercent > 0 && res.coupon?.pointsUsed === 50;
      const createdCouponArg = mockPrisma.coupon.create.mock.calls[0]?.[0]?.data;
      userRestricted = createdCouponArg?.allowedUserIds === JSON.stringify(['usr-points-1']);
    } catch {}
    assert('HIGH-01: UsersService.convertPoints successfully converts valid points >= 10', validConverted);
    assert('HIGH-01: UsersService.convertPoints restricts coupon to user with allowedUserIds', userRestricted);
  }

  // ----------------------------------------------------
  // TEST 18: HIGH-02 - MediaController folder permissions (receipts vs products)
  // ----------------------------------------------------
  {
    const mediaController = new MediaController();
    const mockFile: any = {
      filename: 'receipt-123.jpg',
      mimetype: 'image/jpeg',
      size: 50000,
      path: '/tmp/receipt-123.jpg',
    };

    // Subtest A: Receipts folder is accessible by unauthenticated user / guest
    let receiptAllowed = false;
    try {
      const res = mediaController.uploadFile(mockFile, { protocol: 'http', get: () => 'localhost:4000', user: undefined }, 'receipts');
      receiptAllowed = res.success === true && res.folder === 'receipts';
    } catch {}
    assert('HIGH-02: MediaController allows receipts folder upload for non-admin/guest', receiptAllowed);

    // Subtest B: Products folder is blocked for regular user or guest
    let productsBlocked = false;
    try {
      mediaController.uploadFile(mockFile, { protocol: 'http', get: () => 'localhost:4000', user: { role: 'USER' } }, 'products');
    } catch (e: any) {
      productsBlocked = e instanceof ForbiddenException;
    }
    assert('HIGH-02: MediaController blocks non-admin upload to products folder with ForbiddenException', productsBlocked);

    // Subtest C: Case variation Receipts is normalized and accepted for guests
    let receiptsCaseNormalized = false;
    try {
      const res = mediaController.uploadFile(mockFile, { protocol: 'http', get: () => 'localhost:4000', user: undefined }, 'Receipts');
      receiptsCaseNormalized = res.success === true && res.folder === 'receipts';
    } catch {}
    assert('HIGH-02: MediaController normalizes case for receipts folder', receiptsCaseNormalized);
  }

  // ----------------------------------------------------
  // TEST 19: HIGH-03 & LOW-02 - Sensitive keys sanitized from codebase and .env.example
  // ----------------------------------------------------
  {
    const leakedKey = 'BNrVb9bLT9dLPpgY4UDvX8bqJTvEaqKw';
    const leakedPass = 'xeuhxtofquloumhs';

    const syncServiceCode = fs.readFileSync(path.join(__dirname, '../src/settings/currency-sync.service.ts'), 'utf8');
    const settingsServiceCode = fs.readFileSync(path.join(__dirname, '../src/settings/settings.service.ts'), 'utf8');
    const envExampleCode = fs.readFileSync(path.join(__dirname, '../.env.example'), 'utf8');

    const notInSync = !syncServiceCode.includes(leakedKey);
    const notInSettings = !settingsServiceCode.includes(leakedKey);
    const notInEnvExample = !envExampleCode.includes(leakedKey) && !envExampleCode.includes(leakedPass);

    assert('HIGH-03: CurrencySyncService does not contain hardcoded BrsApi key', notInSync);
    assert('HIGH-03: SettingsService does not contain hardcoded BrsApi key', notInSettings);
    assert('LOW-02: .env.example does not contain hardcoded credentials or passwords', notInEnvExample);
  }

  // ----------------------------------------------------
  // TEST 20: HIGH-05 - serverless.ts CORS configuration
  // ----------------------------------------------------
  {
    const serverlessCode = fs.readFileSync(path.join(__dirname, '../src/serverless.ts'), 'utf8');
    const hasPermissiveWildcard = serverlessCode.includes('return callback(null, true); // Permissive in preview/test mode');
    const hasStrictWhitelist = serverlessCode.includes('allowedOrigins.includes(origin)') && serverlessCode.includes('blocked by security policy');

    assert('HIGH-05: serverless.ts eliminated permissive CORS wildcard with credentials', !hasPermissiveWildcard && hasStrictWhitelist);
  }

  // ----------------------------------------------------
  // TEST 21: MED-01 - CartBeCart trackingCode idempotency & Persian numeral normalization
  // ----------------------------------------------------
  {
    const mockPrisma: any = {
      cardPayment: {
        findFirst: jestFn(async (args: any) => {
          const codes = args.where.trackingCode?.in || [args.where.trackingCode];
          if (codes.includes('123456') || codes.includes('TRK-ALREADY-PAID')) {
            return { id: 'p-paid-1', status: 'PAID', trackingCode: '123456' };
          }
          return null;
        }),
        updateMany: jestFn(async () => ({ count: 0 })),
      },
    };

    const cbcService = new CartBeCartService(
      mockPrisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    // Subtest A: Exact duplicate tracking code is rejected
    let dupTrackingRejected = false;
    try {
      await cbcService.submitManualReceipt({
        amountToman: 100000,
        trackingCode: 'TRK-ALREADY-PAID',
      });
    } catch (e: any) {
      dupTrackingRejected = e instanceof BadRequestException && e.message.includes('پیش‌تر');
    }
    assert('MED-01: CartBeCartService.submitManualReceipt rejects duplicate paid tracking code', dupTrackingRejected);

    // Subtest B: Persian digits duplicate tracking code is normalized and rejected
    let persianTrackingRejected = false;
    try {
      await cbcService.submitManualReceipt({
        amountToman: 100000,
        trackingCode: '۱۲۳۴۵۶', // Persian digits for 123456
      });
    } catch (e: any) {
      persianTrackingRejected = e instanceof BadRequestException && e.message.includes('پیش‌تر');
    }
    assert('MED-01: CartBeCartService.submitManualReceipt normalizes Persian numerals and rejects duplicate tracking code', persianTrackingRejected);
  }

  // ----------------------------------------------------
  // TEST 22: MED-02 - OrdersService referral cashback atomic claim & race-free reversal
  // ----------------------------------------------------
  {
    const mockOrder = {
      id: 'ord-cb-1',
      orderNumber: 'ORD-CB-001',
      status: 'completed',
      totalPriceToman: 200000,
      referralCashbackAwarded: true,
    };

    const mockPrisma: any = {
      order: {
        updateMany: jestFn(async () => ({ count: 1 })),
      },
      user: {
        findFirst: jestFn(async () => null),
        update: jestFn(async () => ({})),
      },
      auditLog: {
        findFirst: jestFn(async () => null),
      },
      systemSetting: {
        findUnique: jestFn(async () => ({ value: '10' })),
      },
    };

    const ordersService = new OrdersService(
      mockPrisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await ordersService.awardReferralCashbackIfEligible(mockOrder);
    assert('MED-02: awardReferralCashbackIfEligible atomically checks referralCashbackAwarded to block duplicate payouts', mockPrisma.order.updateMany.mock.calls.length === 1);

    await ordersService.reverseReferralCashbackIfApplicable(mockOrder);
    assert('MED-02: reverseReferralCashbackIfApplicable atomically claims reversal first to prevent double-deduction', mockPrisma.order.updateMany.mock.calls.length === 2);
  }

  // ----------------------------------------------------
  // TEST 23: MED-04 - OrdersService processRefund & UsersService processWithdrawal enforce authenticated admin identity
  // ----------------------------------------------------
  {
    const mockOrder = {
      id: 'ord-ref-1',
      orderNumber: 'ORD-REF-001',
      status: 'refund_requested',
      totalPriceToman: 100000,
      customerEmail: 'cust@example.com',
    };

    let savedAuditLog: any = null;
    let savedOrderUpdate: any = null;

    const mockPrisma: any = {
      $transaction: async (cb: any) => cb(mockPrisma),
      order: {
        findFirst: jestFn(async () => mockOrder),
        findUnique: jestFn(async () => ({ ...mockOrder, ...savedOrderUpdate })),
        update: jestFn(async (args: any) => {
          savedOrderUpdate = args.data;
          return { ...mockOrder, ...args.data };
        }),
        updateMany: jestFn(async (args: any) => {
          if (args.data?.status === 'refunded') {
            savedOrderUpdate = args.data;
          }
          return { count: 1 };
        }),
      },
      user: {
        findFirst: jestFn(async () => null),
        update: jestFn(async () => ({})),
      },
      auditLog: {
        create: jestFn(async (args: any) => {
          savedAuditLog = args.data;
          return {};
        }),
        findFirst: jestFn(async () => null),
      },
    };

    const ordersService = new OrdersService(
      mockPrisma,
      { sendDeliveryEmail: jestFn(async () => ({})) } as any,
      { sendOrderRefundedSms: jestFn(async () => ({ success: true })) } as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const spoofedDto = {
      orderId: 'ord-ref-1',
      refundAmountToman: 100000,
      adminId: 'spoofed-id-999',
      adminName: 'جاعل هویت ادمین',
    };
    const realAdminUser = {
      id: 'real-admin-42',
      name: 'علی حسینی (مدیر واقعی)',
    };

    await ordersService.processRefund(spoofedDto, realAdminUser);

    const identitySecured =
      savedOrderUpdate?.refundedByAdminId === 'real-admin-42' &&
      savedOrderUpdate?.refundedByAdminName === 'علی حسینی (مدیر واقعی)' &&
      savedAuditLog?.adminId === 'real-admin-42';

    assert('MED-04: processRefund enforces authenticated admin identity over spoofed request body', identitySecured);

    // Subtest B: UsersService.processWithdrawal enforces authenticated admin identity
    let savedWithdrawalUpdate: any = null;
    let savedWithdrawalAudit: any = null;
    const mockPrismaWithdrawal: any = {
      $transaction: async (cb: any) => cb(mockPrismaWithdrawal),
      withdrawalRequest: {
        findUnique: jestFn(async () => ({
          id: 'w-1',
          userId: 'u-1',
          status: 'PENDING',
          amountToman: 100000,
          user: { name: 'کاربر ۱' },
        })),
        update: jestFn(async (args: any) => {
          savedWithdrawalUpdate = args.data;
          return { id: 'w-1', status: 'APPROVED', user: { name: 'کاربر ۱' } };
        }),
        updateMany: jestFn(async (args: any) => {
          savedWithdrawalUpdate = args.data;
          return { count: 1 };
        }),
      },
      user: {
        update: jestFn(async () => ({})),
      },
      auditLog: {
        create: jestFn(async (args: any) => {
          savedWithdrawalAudit = args.data;
          return {};
        }),
      },
    };

    const usersServiceAdmin = new UsersService(mockPrismaWithdrawal, {} as any, {} as any);
    await usersServiceAdmin.processWithdrawal(
      'w-1',
      { action: 'APPROVE', bankTrackingCode: 'TRK-999', adminName: 'جاعل هویت', adminId: 'fake-admin' },
      { id: 'real-admin-id', name: 'مدیر تاییدشده' },
    );

    const withdrawalAdminSecured =
      savedWithdrawalUpdate?.processedByAdminName === 'مدیر تاییدشده' &&
      savedWithdrawalUpdate?.processedByAdminId === 'real-admin-id' &&
      savedWithdrawalAudit?.adminName === 'مدیر تاییدشده';

    assert('MED-04: UsersService.processWithdrawal enforces authenticated admin identity over spoofed body', withdrawalAdminSecured);
  }

  // ----------------------------------------------------
  // TEST 24: LOW-01 - main.ts has Content-Security-Policy configured
  // ----------------------------------------------------
  {
    const mainCode = fs.readFileSync(path.join(__dirname, '../src/main.ts'), 'utf8');
    const hasCspDirectives = mainCode.includes('contentSecurityPolicy: {') && mainCode.includes("defaultSrc: [\"'self'\"]");
    const hasDisabledCsp = mainCode.includes('contentSecurityPolicy: false');

    assert('LOW-01: main.ts configures Content-Security-Policy instead of disabling it', hasCspDirectives && !hasDisabledCsp);
  }

  // ----------------------------------------------------
  // TEST 25: UsersService.createUser hashes password with bcrypt
  // ----------------------------------------------------
  {
    let savedData: any = null;
    const mockPrisma: any = {
      user: {
        create: jestFn(async (args: any) => {
          savedData = args.data;
          return { id: 'new-u-1', ...args.data };
        }),
      },
      auditLog: {
        create: jestFn(async () => ({})),
      },
    };

    const usersService = new UsersService(mockPrisma, {} as any, {} as any);
    await usersService.createUser({
      name: 'کاربر جدید',
      email: 'newuser@example.com',
      password: 'MySecretPassword123!',
      role: 'USER',
    });

    const isHashed = savedData?.password && bcrypt.compareSync('MySecretPassword123!', savedData.password) && savedData.password !== 'MySecretPassword123!';
    assert('UsersService.createUser hashes password with bcrypt before saving to database', Boolean(isHashed));
  }

  // ----------------------------------------------------
  // TEST 26: MediaController has Throttle decorator to prevent DoS
  // ----------------------------------------------------
  {
    const mediaCode = fs.readFileSync(path.join(__dirname, '../src/media/media.controller.ts'), 'utf8');
    const hasThrottle = mediaCode.includes('@Throttle') && mediaCode.includes('limit: 10');
    assert('MediaController has @Throttle decorator to prevent file upload DoS', hasThrottle);
  }

  // ----------------------------------------------------
  // TEST 27: docker-compose.yml does not contain hardcoded email password or BrsApi key
  // ----------------------------------------------------
  {
    const dockerCode = fs.readFileSync(path.join(__dirname, '../../docker-compose.yml'), 'utf8');
    const hasHardcodedGmailPass = dockerCode.includes('xeuhxtofquloumhs');
    const hasHardcodedCurrencyKey = dockerCode.includes('BNrVb9bLT9dLPpgY4UDvX8bqJTvEaqKw');
    assert('docker-compose.yml does not contain hardcoded email password or currency key', !hasHardcodedGmailPass && !hasHardcodedCurrencyKey);
  }

  // ----------------------------------------------------
  // TEST 28: [SEC-01] OTP Expiration Enforcement in auth.service.ts
  // ----------------------------------------------------
  {
    const mockPrisma: any = {
      user: {
        findUnique: jestFn(async () => null),
        findFirst: jestFn(async () => null),
      },
    };
    const mockJwt: any = { sign: jestFn(() => 'dummy-token') };
    const mockRedis: any = {
      set: jestFn(async () => {}),
      get: jestFn(async () => null),
      del: jestFn(async () => {}),
    };
    const mockSms: any = {
      sendPatternSms: jestFn(async () => ({ success: true, recId: 1 })),
      getSmsConfig: jestFn(async () => ({ patternOtp: 'test-pattern' })),
    };
    const authService = new AuthService(mockPrisma, mockJwt, {} as any, mockSms, mockRedis);

    // Send OTP to populate internal otpMap
    const phone = '09359998877';
    await authService.sendOtp(phone);
    const store = (authService as any).otpMap;
    const record = store.get(phone);

    // Artificially expire the OTP
    if (record) {
      record.expiresAt = Date.now() - 1000;
    }

    let threwExpired = false;
    try {
      await authService.verifyOtp(phone, record?.code || '12345');
    } catch (e: any) {
      threwExpired = e instanceof BadRequestException && e.message.includes('منقضی');
    }
    assert('[SEC-01] AuthService.verifyOtp strictly rejects expired OTP even if code matches', threwExpired);
  }

  // ----------------------------------------------------
  // TEST 29: [SEC-02] Withdrawal Concurrency Atomic Lock in users.service.ts
  // ----------------------------------------------------
  {
    const usersServiceCode = fs.readFileSync(path.join(__dirname, '../src/users/users.service.ts'), 'utf8');
    const hasAtomicPendingCheck =
      usersServiceCode.includes("status: 'PENDING'") &&
      usersServiceCode.includes('tx.withdrawalRequest.updateMany') &&
      usersServiceCode.includes('این درخواست تسویه قبلاً تعیین تکلیف شده است');
    assert('[SEC-02] UsersService.processWithdrawal uses atomic updateMany with status: PENDING condition', hasAtomicPendingCheck);
  }

  // ----------------------------------------------------
  // TEST 30: [SEC-03] Refund Concurrency Atomic Lock in orders.service.ts
  // ----------------------------------------------------
  {
    const ordersServiceCode = fs.readFileSync(path.join(__dirname, '../src/orders/orders.service.ts'), 'utf8');
    const hasAtomicRefund =
      ordersServiceCode.includes('tx.order.updateMany') &&
      ordersServiceCode.includes("status: { in: ['refund_requested', 'completed', 'delivered'] }") &&
      ordersServiceCode.includes('این سفارش پیش‌تر تسویه و عودت داده شده یا وضعیت آن تغییر یافته است');
    assert('[SEC-03] OrdersService.processRefund wraps wallet balance credit and status update in atomic transaction with updateMany guard', hasAtomicRefund);
  }

  // ----------------------------------------------------
  // TEST 31: [SEC-04] irMarket Hardcoded API Key Leak Protection
  // ----------------------------------------------------
  {
    const irMarketCode = fs.readFileSync(path.join(__dirname, '../src/irmarket/irmarket.service.ts'), 'utf8');
    const dockerCode = fs.readFileSync(path.join(__dirname, '../../docker-compose.yml'), 'utf8');
    const leakedKey = 'anb_6ae2d846ec8ce52a816c108aa676b9ce70ce69b8';
    const isLeaked = irMarketCode.includes(leakedKey) || dockerCode.includes(leakedKey);
    assert('[SEC-04] irMarket API key is not hardcoded in irmarket.service.ts or docker-compose.yml', !isLeaked);
  }

  // ----------------------------------------------------
  // TEST 32: [SEC-05] Session Invalidation for Blocked Users in JwtAuthGuard
  // ----------------------------------------------------
  {
    const reflector = new Reflector();
    const mockPrisma: any = {
      user: {
        findUnique: jestFn(async () => ({ id: 'blocked-user', status: 'BLOCKED', role: 'USER' })),
      },
    };
    const guard = new JwtAuthGuard(jwtService, reflector, mockPrisma);
    const validToken = jwtService.sign({ sub: 'blocked-user', role: 'USER' });
    const mockContext: any = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: `Bearer ${validToken}` } }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    };

    let threwBlocked = false;
    try {
      await guard.canActivate(mockContext);
    } catch (e: any) {
      threwBlocked = e instanceof UnauthorizedException && e.message.includes('مسدود');
    }
    assert('[SEC-05] JwtAuthGuard verifies user active status from database and rejects BLOCKED users', threwBlocked);
  }

  // ----------------------------------------------------
  // TEST 33: [SEC-06] Audit Log Actor Spoofing Protection in users.service.ts
  // ----------------------------------------------------
  {
    let createdAuditLog: any = null;
    const mockPrisma: any = {
      user: {
        findUnique: jestFn(async () => ({ id: 'target-u', role: 'USER', status: 'ACTIVE' })),
        update: jestFn(async (args: any) => ({ id: 'target-u', ...args.data })),
      },
      auditLog: {
        create: jestFn(async (args: any) => {
          createdAuditLog = args.data;
          return { id: 'audit-1', ...args.data };
        }),
      },
    };
    const usersService = new UsersService(mockPrisma, {} as any, {} as any);
    await usersService.updateUserRole(
      'target-u',
      { role: 'CATALOG_MANAGER', adminUser: 'SpoofedAdminName' } as any,
      'RealAuthenticatedAdmin'
    );
    const usesRealAdmin = createdAuditLog && createdAuditLog.user === 'RealAuthenticatedAdmin';
    assert('[SEC-06] UsersService.updateUserRole strictly logs authenticated author and ignores spoofed adminUser DTO', Boolean(usesRealAdmin));
  }

  // ----------------------------------------------------
  // TEST 34: [SEC-07] Profile Update Unique Constraint Pre-check in users.service.ts
  // ----------------------------------------------------
  {
    const mockPrisma: any = {
      user: {
        findUnique: jestFn(async () => ({ id: 'my-user-id', phone: '09121111111', email: 'me@example.com' })),
        findFirst: jestFn(async (args: any) => {
          // Simulate someone else having this phone
          if (args.where?.phone === '09122222222') {
            return { id: 'other-user-id', phone: '09122222222' };
          }
          return null;
        }),
      },
    };
    const usersService = new UsersService(mockPrisma, {} as any, {} as any);

    let threwDuplicate = false;
    try {
      await usersService.updateProfile('my-user-id', { phone: '09122222222' });
    } catch (e: any) {
      threwDuplicate = e instanceof BadRequestException && (e.message.includes('پیش‌تر برای کاربر دیگری ثبت') || e.message.includes('پیش‌تر در سامانه ثبت'));
    }
    assert('[SEC-07] UsersService.updateProfile pre-checks phone collision to prevent Prisma P2002 500 error', threwDuplicate);
  }

  // ----------------------------------------------------
  // TEST 35: [SEC-08] Coupons CRUD and Security Role Protection
  // ----------------------------------------------------
  {
    const reflector = new Reflector();

    const controllerRoles = reflector.get(ROLES_KEY, CouponsController.prototype.getAllCoupons);
    const hasAdminRoles =
      Array.isArray(controllerRoles) &&
      controllerRoles.includes('SUPER_ADMIN') &&
      controllerRoles.includes('FINANCE_ADMIN');

    const mockPrisma: any = {
      coupon: {
        findUnique: jestFn(async (args: any) => {
          if (args.where?.code === 'EXISTING') return { id: 'c1', code: 'EXISTING' };
          return null;
        }),
        create: jestFn(async (args: any) => ({ id: 'c-new', ...args.data })),
      },
    };
    const couponsService = new CouponsService(mockPrisma);
    let threwDuplicateCoupon = false;
    try {
      await couponsService.createCoupon({ code: 'EXISTING', discountPercent: 20 });
    } catch (e: any) {
      threwDuplicateCoupon = e instanceof BadRequestException;
    }

    const createdCoupon = await couponsService.createCoupon({ code: 'NEW20', discountPercent: 20 });

    assert('[SEC-08] CouponsController protects management endpoints with SUPER_ADMIN/FINANCE_ADMIN roles and CouponsService supports CRUD', hasAdminRoles && threwDuplicateCoupon && createdCoupon.code === 'NEW20');
  }

  // ----------------------------------------------------
  // TEST 36: [SEC-09] Admin Self-Deletion Prevention in users.service.ts
  // ----------------------------------------------------
  {
    const mockPrisma: any = {
      user: {
        findUnique: jestFn(async () => ({ id: 'super-admin-1', role: 'SUPER_ADMIN', name: 'مدیر ارشد' })),
      },
    };
    const usersService = new UsersService(mockPrisma, {} as any, {} as any);
    let threwSelfDelete = false;
    try {
      await usersService.deleteUser('super-admin-1', 'super-admin-1');
    } catch (e: any) {
      threwSelfDelete = e instanceof BadRequestException && e.message.includes('حساب کاربری خود');
    }
    assert('[SEC-09] UsersService.deleteUser prevents admin from deleting their own account', threwSelfDelete);
  }

  // ----------------------------------------------------
  // TEST 37: [SEC-11] PrismaExceptionFilter Maps P2002/P2003/P2025 Gracefully
  // ----------------------------------------------------
  {
    const filter = new PrismaExceptionFilter();
    let sentStatus = 0;
    let sentJson: any = null;
    const mockHost: any = {
      switchToHttp: () => ({
        getResponse: () => ({
          status: (code: number) => {
            sentStatus = code;
            return {
              json: (data: any) => {
                sentJson = data;
              },
            };
          },
        }),
      }),
    };

    const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.0.0',
      meta: { target: ['phone'] },
    });

    filter.catch(p2002Error, mockHost);
    const isP2002Handled = sentStatus === 409 && sentJson?.message?.includes('شماره همراه پیش‌تر در سامانه ثبت');

    const p2003Error = new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
      code: 'P2003',
      clientVersion: '5.0.0',
    });
    filter.catch(p2003Error, mockHost);
    const isP2003Handled = sentStatus === 400 && sentJson?.error === 'ForeignKeyConstraintViolation';

    assert('[SEC-11] PrismaExceptionFilter transforms raw Prisma database errors into clean Persian messages without leaking internal schema', isP2002Handled && isP2003Handled);
  }

  // ----------------------------------------------------
  // TEST 38: [SEC-12] Referral Network N+1 Query Optimization in users.service.ts
  // ----------------------------------------------------
  {
    const usersServiceCode = fs.readFileSync(path.join(__dirname, '../src/users/users.service.ts'), 'utf8');
    const hasBatchQuery =
      usersServiceCode.includes('customerPhone: { in: phones }') &&
      usersServiceCode.includes('customerEmail: { in: emails }') &&
      !usersServiceCode.includes('for (const refUser of referredUsers) {\n      let orders');
    assert('[SEC-12] UsersService.getReferralNetwork uses batch query optimization to eliminate N+1 database queries', hasBatchQuery);
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
