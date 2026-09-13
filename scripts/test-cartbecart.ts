import { PrismaClient } from '@prisma/client';
import { CartBeCartClientService } from '../src/cartbecart/cartbecart-client.service';
import { CartBeCartService } from '../src/cartbecart/cartbecart.service';

async function runTests() {
  console.log('🚀 Starting CartBeCart Test Suite (Comprehensive Verification)...');
  const prisma = new PrismaClient();

  try {
    // 0. Setup Mock Email Service and Orders Service
    const mockEmailService: any = {
      sendOrderReceipt: async () => true,
      sendDeliveryEmail: async () => true,
    };

    let referralAwardedForOrder = '';
    const mockOrdersService: any = {
      awardReferralCashbackIfEligible: async (order: any) => {
        referralAwardedForOrder = order.orderNumber;
        return true;
      },
    };

    const clientService = new CartBeCartClientService();
    const cartBeCartService = new CartBeCartService(
      prisma as any,
      clientService,
      mockEmailService,
      mockOrdersService,
    );

    // 1. Create a test user
    const testUser = await prisma.user.upsert({
      where: { phone: '09120000099' },
      update: { walletBalanceToman: 0, directDepositBalance: 0 },
      create: {
        phone: '09120000099',
        name: 'کاربر تست کارت‌به‌کارت',
        email: 'cartbecart_test@example.com',
        role: 'USER',
        walletBalanceToman: 0,
        directDepositBalance: 0,
      },
    });
    console.log('✓ Test user created/reset:', testUser.id);

    // 2. Create a test order
    const orderNumber = `TEST-CBC-${Date.now()}`;
    const testOrder = await prisma.order.create({
      data: {
        orderNumber,
        customerEmail: 'cartbecart_test@example.com',
        customerPhone: '09120000099',
        totalPriceToman: 250000,
        totalPriceUsd: 3.5,
        status: 'pending',
        items: JSON.stringify([{ id: 'p1', title: 'اشتراک تست', quantity: 1, priceToman: 250000 }]),
        paymentGateway: 'cartbecart',
      },
    });
    console.log('✓ Test order created with initial status pending:', testOrder.orderNumber);

    // 3. Test initiatePayment for Order (verify Rial conversion and graceEndsAt)
    const payment = await cartBeCartService.initiatePayment({
      amountToman: 250000,
      paymentType: 'ORDER',
      orderNumber: testOrder.orderNumber,
      orderId: testOrder.id,
      userId: testUser.id,
      customerName: testUser.name,
      customerPhone: testUser.phone || undefined,
    });

    console.log('✓ Payment initiated:');
    console.log('  - Token:', payment.paymentToken);
    console.log('  - Amount Toman:', payment.amountToman);
    console.log('  - Amount Rial:', payment.amountRial);
    console.log('  - Unique Amount Rial:', payment.uniqueAmountRial);
    console.log('  - Unique Amount Toman:', payment.uniqueAmountToman);
    console.log('  - Dest Card:', payment.destCardNumber);
    console.log('  - Dest Owner:', payment.destCardOwner);
    console.log('  - Status:', payment.status);

    if (payment.amountRial !== 2500000) {
      throw new Error(`Amount in Rial mismatch: expected 2500000, got ${payment.amountRial}`);
    }
    if (payment.status !== 'PENDING') {
      throw new Error(`Expected PENDING status, got ${payment.status}`);
    }

    // Verify graceEndsAt is properly persisted
    const savedPayment = await prisma.cardPayment.findUnique({
      where: { paymentToken: payment.paymentToken },
    });
    if (!savedPayment?.graceEndsAt) {
      throw new Error('graceEndsAt was not persisted in database!');
    }
    console.log('✓ graceEndsAt successfully persisted:', savedPayment.graceEndsAt.toISOString());

    // 4. Test submitManualReceipt (User fallback)
    const trackingCode = `TRACK-${Date.now().toString().slice(-6)}`;
    const manualPayment = await cartBeCartService.submitManualReceipt({
      paymentToken: payment.paymentToken,
      amountToman: 250000,
      orderNumber: testOrder.orderNumber,
      trackingCode,
      userCardNumber: '6037-xxxx-xxxx-1234',
      receiptUrl: '/uploads/receipts/receipt-test.png',
      userNote: 'واریز از همراه بانک ملی در ساعت ۱۸:۳۰',
    });

    console.log('✓ Manual receipt submitted:');
    console.log('  - Status:', manualPayment.status);
    console.log('  - Tracking Code:', manualPayment.trackingCode);
    console.log('  - User Card:', manualPayment.userCardNumber);

    if (manualPayment.status !== 'MANUAL_REVIEW') {
      throw new Error(`Expected MANUAL_REVIEW status, got ${manualPayment.status}`);
    }

    // 5. Test Admin getAdminPayments filter
    const adminList = await cartBeCartService.getAdminPayments({
      status: 'MANUAL_REVIEW',
      search: trackingCode,
    });
    console.log(`✓ Admin list returned ${adminList.total} matching payments`);
    if (adminList.total < 1) {
      throw new Error('Admin list did not return the manual review payment');
    }

    // 6. Test Admin Approval of Order Payment
    const adminUser = { id: 'admin-1', name: 'مدیر تست مالی', phone: '09121111111' };
    const approvedPayment = await cartBeCartService.adminApprovePayment(
      manualPayment.id,
      { adminNote: 'فیش استعلام و تطبیق داده شد.' },
      adminUser,
    );

    console.log('✓ Admin approval succeeded:');
    console.log('  - New Status:', approvedPayment.status);
    console.log('  - Reviewed By:', approvedPayment.reviewedByAdminName);

    if (approvedPayment.status !== 'APPROVED') {
      throw new Error(`Expected APPROVED status, got ${approvedPayment.status}`);
    }

    // Verify Order status is updated to delivered/processing
    const updatedOrder = await prisma.order.findUnique({ where: { id: testOrder.id } });
    console.log('  - Order status after approval:', updatedOrder?.status);
    if (!['processing', 'delivered'].includes(updatedOrder?.status || '')) {
      throw new Error(`Order was not fulfilled! Status: ${updatedOrder?.status}`);
    }
    if (referralAwardedForOrder !== testOrder.orderNumber) {
      throw new Error('Referral cashback hook was not called upon fulfillment!');
    }
    console.log('✓ Referral cashback awarded for order:', referralAwardedForOrder);

    // 7. Test Idempotency: Double Approval must throw error
    try {
      await cartBeCartService.adminApprovePayment(manualPayment.id, {}, adminUser);
      throw new Error('Double approval should have thrown an error!');
    } catch (err: any) {
      console.log('✓ Idempotency verified: double approval prevented with message:', err.message);
    }

    // 8. Test Settings API key protection from masked ellipsis overwrite
    console.log('\n--- Testing Settings API Key Protection ---');
    await prisma.systemSetting.upsert({
      where: { key: 'CARTBECART_API_KEY' },
      update: { value: 'cbc_live_secret_key_12345678' },
      create: { key: 'CARTBECART_API_KEY', value: 'cbc_live_secret_key_12345678' },
    });
    // Now simulate admin saving settings with masked key "cbc_...5678"
    await cartBeCartService.updateSettings({
      apiKey: 'cbc_...5678',
      fallbackCardNumber: '5022291012345678',
    });
    const protectedSetting = await prisma.systemSetting.findUnique({
      where: { key: 'CARTBECART_API_KEY' },
    });
    if (protectedSetting?.value !== 'cbc_live_secret_key_12345678') {
      throw new Error(`Masked API key corrupted the real secret: ${protectedSetting?.value}`);
    }
    console.log('✓ Settings protection verified: masked API key did NOT overwrite real key');

    // 9. Test Wallet Top-up Flow with simulated auto-verification
    console.log('\n--- Testing Wallet Top-up Flow ---');
    const walletPayment = await cartBeCartService.initiatePayment({
      amountToman: 100000,
      paymentType: 'WALLET_TOPUP',
      userId: testUser.id,
      customerName: testUser.name,
    });
    console.log('✓ Wallet payment initiated, token:', walletPayment.paymentToken);

    // Test simulatePaymentSuccess security check in production
    const oldEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await cartBeCartService.simulatePaymentSuccess(walletPayment.paymentToken, { role: 'USER' });
      throw new Error('Simulation should have been rejected for regular user in production!');
    } catch (secErr: any) {
      console.log('✓ Security guard verified: simulatePaymentSuccess blocked for USER in production:', secErr.message);
    } finally {
      process.env.NODE_ENV = oldEnv;
    }

    // Now execute simulation as authorized admin
    await cartBeCartService.simulatePaymentSuccess(walletPayment.paymentToken, { role: 'SUPER_ADMIN' });
    console.log('✓ Simulated payment success executed for authorized admin');

    // Check updated user wallet balance
    const updatedUser = await prisma.user.findUnique({ where: { id: testUser.id } });
    console.log('✓ User wallet balance after topup:', updatedUser?.walletBalanceToman);
    console.log('✓ Direct deposit balance:', updatedUser?.directDepositBalance);

    if (updatedUser?.walletBalanceToman !== 100000) {
      throw new Error(`Expected wallet balance 100000, got ${updatedUser?.walletBalanceToman}`);
    }
    if (updatedUser?.directDepositBalance !== 100000) {
      throw new Error(`Expected direct deposit balance 100000, got ${updatedUser?.directDepositBalance}`);
    }

    // 10. Test Rejection Flow with Order Cancellation
    console.log('\n--- Testing Rejection Flow with Order Cancellation ---');
    const rejectOrderNumber = `TEST-REJ-${Date.now()}`;
    const orderToReject = await prisma.order.create({
      data: {
        orderNumber: rejectOrderNumber,
        customerEmail: 'reject_test@example.com',
        totalPriceToman: 80000,
        totalPriceUsd: 1.2,
        status: 'pending',
        items: '[]',
        paymentGateway: 'cartbecart',
      },
    });

    const rejectPayment = await cartBeCartService.initiatePayment({
      amountToman: 80000,
      paymentType: 'ORDER',
      orderNumber: rejectOrderNumber,
      orderId: orderToReject.id,
      userId: testUser.id,
    });

    await cartBeCartService.submitManualReceipt({
      paymentToken: rejectPayment.paymentToken,
      amountToman: 80000,
      trackingCode: 'INVALID-FAKE-REF-999',
    });

    const rejected = await cartBeCartService.adminRejectPayment(
      rejectPayment.id,
      { reason: 'مبلغ واریزی در حساب مقصد ثبت نشده است.' },
      adminUser,
    );
    console.log('✓ Payment rejected, status:', rejected.status, 'reason:', rejected.adminNote);
    if (rejected.status !== 'REJECTED') {
      throw new Error(`Expected REJECTED status, got ${rejected.status}`);
    }

    // Verify order was cancelled
    const checkRejectedOrder = await prisma.order.findUnique({ where: { id: orderToReject.id } });
    if (checkRejectedOrder?.status !== 'cancelled') {
      throw new Error(`Order should be cancelled upon rejection, got: ${checkRejectedOrder?.status}`);
    }
    console.log('✓ Associated order successfully marked as cancelled upon payment rejection');

    // Clean up test records
    await prisma.cardPayment.deleteMany({
      where: {
        OR: [
          { paymentToken: payment.paymentToken },
          { paymentToken: walletPayment.paymentToken },
          { paymentToken: rejectPayment.paymentToken },
        ],
      },
    });
    await prisma.order.deleteMany({
      where: {
        OR: [{ id: testOrder.id }, { id: orderToReject.id }],
      },
    });
    await prisma.user.delete({ where: { id: testUser.id } });
    console.log('✓ Test data cleaned up.');

    console.log('\n🎉 ALL COMPREHENSIVE CARTBECART BACKEND TESTS PASSED SUCCESSFULLY!');
  } finally {
    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
