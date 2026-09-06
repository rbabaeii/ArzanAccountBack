import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. System Settings
  const settings = [
    { key: 'USD_TO_RIAL_RATE', value: '720000', description: 'نرخ برابری هر ۱ دلار به ریال' },
    { key: 'DEFAULT_MARGIN_PERCENT', value: '15', description: 'درصد حاشیه سود پیش‌فرض' },
    { key: 'WALLET_BALANCE_USD', value: '0.30', description: 'آخرین موجودی کیف پول irMarket' },
    { key: 'LAST_SYNC_TIME', value: 'هم‌اکنون', description: 'زمان آخرین همگام‌سازی کاتالوگ' },
    { key: 'SITE_NAME', value: 'ارزان اکانت (arzanAccount)', description: 'نام رسمی فروشگاه' },
    { key: 'SUPPORT_TELEGRAM', value: '@arzan_support', description: 'پشتیبانی تلگرام' },
  ];

  for (const s of settings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: s,
    });
  }

  // 2. Initial Categories
  const categories = [
    {
      slug: 'ai',
      title: 'هوش مصنوعی (AI)',
      titleFa: 'اکانت‌های هوش مصنوعی',
      description: 'اکانت‌های اختصاصی ChatGPT Plus، Gemini Pro، Claude و Midjourney با تحویل آنی',
      icon: 'Bot',
      orderIndex: 1,
    },
    {
      slug: 'streaming',
      title: 'فیلم و سریال',
      titleFa: 'اشتراک فیلم و سریال',
      description: 'اشتراک قانونی و فمیلی نتفلیکس، یوتیوب پرمیوم و دیزنی پلاس',
      icon: 'Film',
      orderIndex: 2,
    },
    {
      slug: 'music',
      title: 'موسیقی و پادکست',
      titleFa: 'اشتراک موسیقی',
      description: 'اشتراک اسپاتیفای پریمیوم و اپل موزیک با کیفیت مستر',
      icon: 'Headphones',
      orderIndex: 3,
    },
    {
      slug: 'social-media',
      title: 'شبکه‌های اجتماعی و SMM',
      titleFa: 'خدمات شبکه‌های اجتماعی',
      description: 'تلگرام پرمیوم بدون لاگین، فالوور واقعی اینستاگرام و ممبر تلگرام',
      icon: 'Share2',
      orderIndex: 4,
    },
    {
      slug: 'tools',
      title: 'ابزارهای کاربردی و برنامه‌نویسی',
      titleFa: 'ابزارهای دولوپر و طراحی',
      description: 'اکانت گیت‌هاب کوپایلوت، کانوا پرو، تریدینگ ویو و جت‌برینز',
      icon: 'Sparkles',
      orderIndex: 5,
    },
  ];

  for (const c of categories) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { title: c.title, titleFa: c.titleFa, description: c.description },
      create: c,
    });
  }

  // 3. Initial Users & Admins (RBAC)
  const users = [
    {
      name: 'رضا بابایی (مدیر ارشد سامانه)',
      email: 'reza@arzan.me',
      phone: '09181111111',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      isTwoFactorEnabled: true,
      walletBalanceToman: 1000000,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120',
    },
    {
      name: 'کاربر عادی ارزان اکانت',
      email: 'user@arzan.me',
      phone: '09180000000',
      role: 'USER',
      status: 'ACTIVE',
      isTwoFactorEnabled: false,
      walletBalanceToman: 150000,
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120',
    },
    {
      name: 'سارا رادمنش (مدیر کاتالوگ و محصولات)',
      email: 'sara@arzan.me',
      phone: '09182222222',
      role: 'CATALOG_MANAGER',
      status: 'ACTIVE',
      isTwoFactorEnabled: true,
      walletBalanceToman: 0,
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120',
    },
    {
      name: 'علیرضا تهرانی (مدیر مالی و ارز)',
      email: 'finance@arzan.me',
      phone: '09183333333',
      role: 'FINANCE_ADMIN',
      status: 'ACTIVE',
      isTwoFactorEnabled: true,
      walletBalanceToman: 0,
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120',
    },
    {
      name: 'احسان کریمی (مدیر پشتیبانی و سفارشات)',
      email: 'support@arzan.me',
      phone: '09184444444',
      role: 'SUPPORT_ADMIN',
      status: 'ACTIVE',
      isTwoFactorEnabled: false,
      walletBalanceToman: 0,
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120',
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: u,
      create: u,
    });
  }

  // 4. Initial Audit Log
  await prisma.auditLog.create({
    data: {
      action: 'راه‌اندازی اولیه پایگاه داده و کاربران',
      details: 'تنظیمات اولیه نرخ ارز، دسته‌بندی‌ها و مدیران با سطوح دسترسی RBAC بارگذاری شدند.',
      user: 'سیستم راه‌انداز (Seeder)',
      type: 'security',
    },
  });

  console.log('✅ Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
