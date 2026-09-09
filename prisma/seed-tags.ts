import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function generateSmartTags(customTitle: string, name: string, categoryName?: string | null): string[] {
  const tags: string[] = [];
  const combined = (customTitle + ' ' + name + ' ' + (categoryName || '')).toLowerCase();

  if (combined.includes('تلگرام') || combined.includes('telegram')) {
    tags.push('تلگرام', 'پرمیوم', 'استارز', 'اکانت قانونی', 'telegram');
  }
  if (combined.includes('chatgpt') || combined.includes('هوش مصنوعی') || combined.includes('gpt') || combined.includes('openai')) {
    tags.push('هوش مصنوعی', 'چت جی‌پی‌تی', 'chatgpt', 'openai', 'gpt-4o', 'اشتراک پلاس');
  }
  if (combined.includes('spotify') || combined.includes('اسپاتیفای')) {
    tags.push('اسپاتیفای', 'موزیک', 'spotify', 'پرمیوم موزیک', 'فمیلی');
  }
  if (combined.includes('netflix') || combined.includes('نتفلیکس')) {
    tags.push('نتفلیکس', 'فیلم و سریال', 'netflix', 'اکانت قانونی 4k');
  }
  if (combined.includes('youtube') || combined.includes('یوتیوب')) {
    tags.push('یوتیوب', 'یوتیوب پرمیوم', 'youtube', 'بدون تبلیغات');
  }
  if (combined.includes('vpn') || combined.includes('وی پی ان') || combined.includes('فیلترشکن') || combined.includes('سرور')) {
    tags.push('وی پی ان', 'vpn', 'اینترنت آزاد', 'آی پی ثابت');
  }
  if (combined.includes('game') || combined.includes('steam') || combined.includes('گیم') || combined.includes('استیم')) {
    tags.push('گیمینگ', 'استیم', 'پلی استیشن', 'اکانت بازی');
  }
  if (combined.includes('توییتر') || combined.includes('twitter') || combined.includes(' x ')) {
    tags.push('توییتر', 'اکس', 'تیک آبی', 'x premium');
  }
  if (combined.includes('اپل') || combined.includes('apple')) {
    tags.push('اپل موزیک', 'apple', 'آیکلاد');
  }
  if (combined.includes('دیسکورد') || combined.includes('discord') || combined.includes('نیترو')) {
    tags.push('دیسکورد', 'نیترو', 'discord nitro');
  }

  if (tags.length === 0) {
    tags.push('اشتراک قانونی', 'تحویل فوری', 'ضمانت بازگشت وجه');
  }

  return Array.from(new Set(tags));
}

async function main() {
  console.log('Seeding smart tags for all products in database...');
  const products = await prisma.product.findMany({
    include: { category: true },
  });

  let count = 0;
  for (const p of products) {
    const tags = generateSmartTags(p.customTitle, p.name, p.category?.titleFa);
    await prisma.product.update({
      where: { id: p.id },
      data: { tags: JSON.stringify(tags) },
    });
    count++;
  }

  console.log(`Successfully assigned tags to ${count} products.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
