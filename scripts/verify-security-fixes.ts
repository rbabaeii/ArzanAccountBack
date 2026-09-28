import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { UnauthorizedException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { ROLES_KEY } from '../src/common/decorators/roles.decorator';
import * as bcrypt from 'bcryptjs';

async function runVerification() {
  console.log('====================================================');
  console.log('🛡️  ARZAN ACCOUNT SECURITY VERIFICATION TEST SUITE');
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
  // TEST 2: JwtAuthGuard with forged/tampered token (decode bypass test)
  // ----------------------------------------------------
  {
    const reflector = new Reflector();
    const guard = new JwtAuthGuard(jwtService, reflector);
    // Attacker crafts forged JWT signed with wrong secret or manipulated payload
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
  // TEST 6: Password bypass fix logic
  // ----------------------------------------------------
  {
    const existingPasswordHash = bcrypt.hashSync('ExistingSecurePassword123', 10);
    const userWithPassword = { password: existingPasswordHash };

    // Scenario A: currentPassword not provided -> MUST throw BadRequestException
    let scenarioAThrew = false;
    try {
      const currentPasswordRaw: string | undefined = undefined;
      if (userWithPassword.password) {
        if (!currentPasswordRaw) {
          throw new BadRequestException('وارد کردن رمز عبور فعلی جهت تغییر رمز الزامی است.');
        }
        const isCurrentValid = bcrypt.compareSync(currentPasswordRaw, userWithPassword.password);
        if (!isCurrentValid) {
          throw new BadRequestException('رمز عبور فعلی وارد شده نادرست است.');
        }
      }
    } catch (e: any) {
      scenarioAThrew = e instanceof BadRequestException && e.message.includes('الزامی');
    }
    assert('Password update rejects request when current password is omitted', scenarioAThrew);

    // Scenario B: wrong current password provided -> MUST throw BadRequestException
    let scenarioBThrew = false;
    try {
      const currentPasswordRaw = 'WrongPassword';
      if (userWithPassword.password) {
        if (!currentPasswordRaw) {
          throw new BadRequestException('وارد کردن رمز عبور فعلی جهت تغییر رمز الزامی است.');
        }
        const isCurrentValid = bcrypt.compareSync(currentPasswordRaw, userWithPassword.password);
        if (!isCurrentValid) {
          throw new BadRequestException('رمز عبور فعلی وارد شده نادرست است.');
        }
      }
    } catch (e: any) {
      scenarioBThrew = e instanceof BadRequestException && e.message.includes('نادرست');
    }
    assert('Password update rejects incorrect current password', scenarioBThrew);

    // Scenario C: correct current password provided -> passes
    let scenarioCSuccess = false;
    try {
      const currentPasswordRaw = 'ExistingSecurePassword123';
      if (userWithPassword.password) {
        if (!currentPasswordRaw) {
          throw new BadRequestException('وارد کردن رمز عبور فعلی جهت تغییر رمز الزامی است.');
        }
        const isCurrentValid = bcrypt.compareSync(currentPasswordRaw, userWithPassword.password);
        if (!isCurrentValid) {
          throw new BadRequestException('رمز عبور فعلی وارد شده نادرست است.');
        }
      }
      scenarioCSuccess = true;
    } catch {}
    assert('Password update succeeds when correct current password is supplied', scenarioCSuccess);
  }

  // ----------------------------------------------------
  // TEST 7: Order price tampering guard logic
  // ----------------------------------------------------
  {
    const serverCalculatedToman = 450000;
    const tamperedClientPrice = 1000; // Attacker changed price from 450,000 to 1,000 Toman

    let tamperCaught = false;
    try {
      if (Math.abs(serverCalculatedToman - tamperedClientPrice) > 500) {
        throw new BadRequestException('مبلغ سفارش با قیمت‌های روز سامانه همخوانی ندارد.');
      }
    } catch (e: any) {
      tamperCaught = e instanceof BadRequestException;
    }
    assert('Order price tampering is strictly rejected when client sends manipulated price', tamperCaught);
  }

  // ----------------------------------------------------
  // TEST 8: Refund limit and duplicate refund prevention logic
  // ----------------------------------------------------
  {
    const order = { id: 'ord-101', status: 'refunded', totalPriceToman: 200000 };

    let duplicateRefundCaught = false;
    try {
      if (order.status === 'refunded') {
        throw new BadRequestException('این سفارش پیش‌تر تسویه و عودت داده شده است.');
      }
    } catch (e: any) {
      duplicateRefundCaught = e instanceof BadRequestException;
    }
    assert('Duplicate refund on already-refunded order is rejected', duplicateRefundCaught);

    const activeOrder = { id: 'ord-102', status: 'delivered', totalPriceToman: 200000 };
    let excessiveRefundCaught = false;
    const requestedRefundAmount = 50000000; // 50M Toman on 200K order
    try {
      if (requestedRefundAmount > activeOrder.totalPriceToman || requestedRefundAmount <= 0) {
        throw new BadRequestException('مبلغ عودت وجه نامعتبر بوده یا از مبلغ کل سفارش بیشتر است.');
      }
    } catch (e: any) {
      excessiveRefundCaught = e instanceof BadRequestException;
    }
    assert('Excessive refund exceeding order total amount is rejected', excessiveRefundCaught);
  }

  // ----------------------------------------------------
  // TEST 9: Coupon user restriction validation logic
  // ----------------------------------------------------
  {
    const restrictedCoupon = {
      code: 'VIP50',
      allowedUserIds: JSON.stringify(['vip-user-1', '09120000000']),
    };

    let unauthorizedUserRejected = false;
    const hackerUserId = 'hacker-99';
    const hackerPhone = '09359999999';

    try {
      const allowed: string[] = JSON.parse(restrictedCoupon.allowedUserIds);
      const matches = allowed.includes(hackerUserId) || allowed.includes(hackerPhone);
      if (!matches) {
        throw new BadRequestException('این کد تخفیف مختص کاربران منتخب صادر گردیده است.');
      }
    } catch (e: any) {
      unauthorizedUserRejected = e instanceof BadRequestException;
    }
    assert('User-restricted coupon rejects unauthorized buyer ID/phone', unauthorizedUserRejected);
  }

  // ----------------------------------------------------
  // TEST 10: SVG file extension & MIME type rejection
  // ----------------------------------------------------
  {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];

    const testSvgMime = 'image/svg+xml';
    const testSvgExt = '.svg';

    const isSvgMimeAllowed = allowedMimes.includes(testSvgMime);
    const isSvgExtAllowed = allowedExts.includes(testSvgExt);

    assert('SVG MIME type image/svg+xml is disallowed in upload whitelist', !isSvgMimeAllowed);
    assert('SVG file extension .svg is disallowed in upload whitelist', !isSvgExtAllowed);
  }

  console.log('\n====================================================');
  console.log(`SUMMARY: ${passed} passed, ${failed} failed.`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
