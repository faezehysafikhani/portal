// HR quarterly evaluation rubric — transcribed verbatim from «دستورالعمل جامع ارزیابی عملکرد و رفتاری»
// (9 categories, 70 sub-indicators, 100 points total: 70 فنی + 30 رفتاری).
// Single source of truth for scoring — mirrored on the frontend (quarterlyRubric.ts) for rendering only;
// all point computation and validation MUST happen here, server-side.

export interface RubricItem { code: string; label: string; max: number }
export interface RubricCategory { code: string; label: string; group: 'Technical' | 'Behavioral'; max: number; items: RubricItem[] }

export const rubric: RubricCategory[] = [
  {
    code: 'quality', label: 'کیفیت خروجی', group: 'Technical', max: 20,
    items: [
      { code: 'quality_1', label: 'میزان انطباق خروجی با الزامات و نیازمندی‌ها', max: 5 },
      { code: 'quality_2', label: 'تعداد خطاها، باگ‌ها یا نیاز به اصلاح پس از تحویل', max: 4 },
      { code: 'quality_3', label: 'دقت و توجه به جزئیات در انجام کار', max: 3 },
      { code: 'quality_4', label: 'کامل بودن خروجی (عدم نیاز به تکمیل توسط دیگران)', max: 2 },
      { code: 'quality_5', label: 'رعایت استانداردها، فرآیندها و دستورالعمل‌ها', max: 2 },
      { code: 'quality_6', label: 'رضایت مدیر یا ذی‌نفعان از کیفیت کار', max: 2 },
      { code: 'quality_7', label: 'قابلیت اتکا و پایداری خروجی در طول زمان', max: 1 },
      { code: 'quality_8', label: 'میزان نوآوری و ارائه راهکارهای بهبود در خروجی', max: 1 },
    ],
  },
  {
    code: 'timeliness', label: 'تعهد زمانی', group: 'Technical', max: 15,
    items: [
      { code: 'timeliness_1', label: 'درصد وظایف تحویل‌شده در موعد مقرر', max: 4.5 },
      { code: 'timeliness_2', label: 'تعداد دفعات تأخیر در تحویل پروژه یا تسک', max: 2.25 },
      { code: 'timeliness_3', label: 'توانایی برنامه‌ریزی و تخمین صحیح زمان', max: 2.25 },
      { code: 'timeliness_4', label: 'اطلاع‌رسانی به‌موقع در صورت ریسک تأخیر', max: 1.5 },
      { code: 'timeliness_5', label: 'میزان نیاز به پیگیری مدیر برای انجام کارها', max: 1.5 },
      { code: 'timeliness_6', label: 'پایبندی به مایلستون‌ها و نقاط کنترل پروژه', max: 1.5 },
      { code: 'timeliness_7', label: 'تحویل به‌موقع گزارش‌های دوره‌ای و مستندات', max: 0.75 },
      { code: 'timeliness_8', label: 'مدیریت هم‌زمان چند مسئولیت بدون تأخیر', max: 0.75 },
    ],
  },
  {
    code: 'responsibility', label: 'مسئولیت‌پذیری فنی', group: 'Technical', max: 15,
    items: [
      { code: 'responsibility_1', label: 'پیگیری مستمر وظایف تا حصول نتیجه نهایی', max: 3.75 },
      { code: 'responsibility_2', label: 'عدم رها کردن یا فراموشی تسک‌ها و مسئولیت‌ها', max: 3.0 },
      { code: 'responsibility_3', label: 'ارائه گزارش وضعیت و پیشرفت کار به‌صورت منظم', max: 2.25 },
      { code: 'responsibility_4', label: 'پیگیری وابستگی‌ها و هماهنگی با سایر واحدها', max: 2.25 },
      { code: 'responsibility_5', label: 'شناسایی و رفع موانع در مسیر انجام کار', max: 1.5 },
      { code: 'responsibility_6', label: 'نیاز کم به یادآوری و پیگیری از سوی مدیر', max: 1.5 },
      { code: 'responsibility_7', label: 'بستن رسمی و مستندسازی پایان کار (Closure)', max: 0.75 },
    ],
  },
  {
    code: 'collaboration', label: 'همکاری تیمی', group: 'Technical', max: 10,
    items: [
      { code: 'collaboration_1', label: 'همکاری مؤثر برای دستیابی به اهداف مشترک', max: 2.5 },
      { code: 'collaboration_2', label: 'مشارکت در تبادل دانش و انتقال تجربیات', max: 1.5 },
      { code: 'collaboration_3', label: 'پاسخگویی و تعامل مناسب با همکاران', max: 1.5 },
      { code: 'collaboration_4', label: 'میزان هماهنگی با سایر واحدها و ذی‌نفعان', max: 1.5 },
      { code: 'collaboration_5', label: 'مشارکت فعال در جلسات و حل مسائل تیمی', max: 1.0 },
      { code: 'collaboration_6', label: 'احترام به نظرات و پذیرش بازخورد دیگران', max: 1.0 },
      { code: 'collaboration_7', label: 'حمایت از تیم در شرایط بحرانی یا حجم کار بالا', max: 0.5 },
      { code: 'collaboration_8', label: 'مدیریت تعارض و حفظ فضای حرفه‌ای در تیم', max: 0.5 },
    ],
  },
  {
    code: 'growth', label: 'حل مسئله و رشد', group: 'Technical', max: 10,
    items: [
      { code: 'growth_1', label: 'توانایی شناسایی و تحلیل ریشه‌ای مسائل', max: 2.0 },
      { code: 'growth_2', label: 'ارائه راه‌حل‌های مؤثر و قابل اجرا', max: 2.0 },
      { code: 'growth_3', label: 'سرعت و کیفیت تصمیم‌گیری در شرایط چالشی', max: 1.0 },
      { code: 'growth_4', label: 'میزان استقلال در حل مشکلات (عدم وابستگی به مدیر)', max: 1.5 },
      { code: 'growth_5', label: 'یادگیری از اشتباهات و جلوگیری از تکرار آن‌ها', max: 1.0 },
      { code: 'growth_6', label: 'توسعه مهارت‌های تخصصی و حرفه‌ای', max: 1.0 },
      { code: 'growth_7', label: 'پذیرش بازخورد و به‌کارگیری آن در عملکرد', max: 1.0 },
      { code: 'growth_8', label: 'افزایش سطح مسئولیت‌پذیری و بلوغ شغلی', max: 0.5 },
    ],
  },
  {
    code: 'respect', label: 'احترام و حرفه‌ای‌گری', group: 'Behavioral', max: 9,
    items: [
      { code: 'respect_1', label: 'رعایت احترام در تعامل با مدیران، همکاران و مراجعین', max: 1.8 },
      { code: 'respect_2', label: 'رعایت ادب و لحن حرفه‌ای در مکاتبات و جلسات', max: 1.35 },
      { code: 'respect_3', label: 'پایبندی به اصول اخلاق حرفه‌ای (صداقت و رازداری)', max: 1.35 },
      { code: 'respect_4', label: 'مدیریت اختلاف‌نظرها و تعارضات به‌صورت حرفه‌ای', max: 0.9 },
      { code: 'respect_5', label: 'رعایت نظم، انضباط و آداب محیط کار', max: 0.9 },
      { code: 'respect_6', label: 'پذیرش و ارائه بازخورد به شیوه محترمانه و سازنده', max: 0.9 },
      { code: 'respect_7', label: 'حفظ شأن و اعتبار سازمان در محیط کار و خارج از آن', max: 0.9 },
      { code: 'respect_8', label: 'پرهیز از رفتارهای نامناسب (حاشیه‌سازی و تنش)', max: 0.9 },
    ],
  },
  {
    code: 'honesty', label: 'صداقت در رفتار و گزارش‌دهی', group: 'Behavioral', max: 9,
    items: [
      { code: 'honesty_1', label: 'صحت و دقت اطلاعات در گزارش‌ها و مکاتبات', max: 1.8 },
      { code: 'honesty_2', label: 'صداقت در اعلام پیشرفت، تأخیرها و مشکلات', max: 1.35 },
      { code: 'honesty_3', label: 'پذیرش اشتباهات و مسئولیت‌پذیری در قبال آن‌ها', max: 1.35 },
      { code: 'honesty_4', label: 'عدم پنهان‌کاری یا ارائه اطلاعات ناقص', max: 1.35 },
      { code: 'honesty_5', label: 'پایبندی به اصول اخلاقی در تعامل با تیم', max: 0.9 },
      { code: 'honesty_6', label: 'امانت‌داری و حفظ محرمانگی اطلاعات', max: 0.9 },
      { code: 'honesty_7', label: 'ارائه گزارش‌های شفاف و قابل راستی‌آزمایی', max: 0.9 },
      { code: 'honesty_8', label: 'رعایت انصاف حرفه‌ای و عدم انتساب کار دیگران به خود', max: 0.45 },
    ],
  },
  {
    code: 'workspace', label: 'نظم و آراستگی محیط کار (5S)', group: 'Behavioral', max: 7,
    items: [
      { code: 'workspace_1', label: 'رعایت نظم و چیدمان میز و تجهیزات (Seiton)', max: 1.05 },
      { code: 'workspace_2', label: 'حفظ پاکیزگی محیط کار و تجهیزات (Seiso)', max: 1.05 },
      { code: 'workspace_3', label: 'تفکیک و حذف اقلام غیرضروری (Seiri)', max: 0.7 },
      { code: 'workspace_4', label: 'رعایت استانداردهای نگهداری اسناد و فایل‌ها (Seiketsu)', max: 1.05 },
      { code: 'workspace_5', label: 'پایبندی مستمر به اصول 5S بدون نیاز به تذکر (Shitsuke)', max: 1.05 },
      { code: 'workspace_6', label: 'نظم در مدیریت فایل‌های دیجیتال و فیزیکی', max: 0.7 },
      { code: 'workspace_7', label: 'اهمیت به وجود ملزومات بهداشتی (آب، دستمال) در محیط', max: 0.7 },
      { code: 'workspace_8', label: 'آراستگی میز (نبود سیم)، صندلی صاف و نظافت ظروف', max: 0.7 },
    ],
  },
  {
    code: 'discipline', label: 'انضباط کاری', group: 'Behavioral', max: 5,
    items: [
      { code: 'discipline_1', label: 'رعایت دقیق ساعات کاری (ورود، خروج و تأخیر)', max: 1.0 },
      { code: 'discipline_2', label: 'رعایت قوانین، آیین‌نامه‌ها و دستورالعمل‌های سازمان', max: 0.75 },
      { code: 'discipline_3', label: 'پایبندی به فرآیندها و رویه‌های کاری تعیین‌شده', max: 0.75 },
      { code: 'discipline_4', label: 'رعایت زمان‌بندی جلسات و تحویل گزارش‌ها', max: 0.75 },
      { code: 'discipline_5', label: 'نظم در مکاتبات و مستندسازی اطلاعات', max: 0.5 },
      { code: 'discipline_6', label: 'اطلاع‌رسانی صحیح درباره تأخیر یا مرخصی', max: 0.5 },
      { code: 'discipline_7', label: 'عدم ثبت تذکرات انضباطی یا شکایات عملکردی', max: 0.5 },
      { code: 'discipline_8', label: 'رعایت پوشش و الزامات رفتاری محیط کار', max: 0.25 },
    ],
  },
]

export const adjustmentCatalog = {
  Bonus: [
    { code: 'cost_reduction', label: 'کاهش هزینه‌های شرکت (زمانی و مالی)', points: 1 },
    { code: 'productivity_increase', label: 'افزایش بهره‌وری (خروجی فراتر از ظرفیت)', points: 1 },
    { code: 'significant_progress', label: 'پیشرفت چشمگیر (نسبت به دوره ارزیابی قبل)', points: 2 },
  ],
  Malus: [
    { code: 'disrespect', label: 'بی‌احترامی به مدیران یا همکاران', points: -1 },
    { code: 'workspace_disorder', label: 'بی‌نظمی مکرر در محیط کار یا فایل‌ها', points: -1 },
    { code: 'unexcused_absence', label: 'غیبت یا تأخیر بدون اطلاع قبلی', points: -2 },
    { code: 'borderline_persistence', label: 'پایداری در مرز ۷۰-۷۵', points: -3 },
  ],
}

export function computeScoreCardTotals(scores: Record<string, unknown>): { technical: number; behavioral: number; total: number; normalized: Record<string, number> } {
  const normalized: Record<string, number> = {}
  for (const category of rubric) {
    for (const item of category.items) {
      const raw = Number(scores[item.code] ?? 0)
      normalized[item.code] = Number.isFinite(raw) ? Math.max(0, Math.min(item.max, raw)) : 0
    }
  }
  let technical = 0, behavioral = 0
  for (const category of rubric) {
    const sum = category.items.reduce((s, i) => s + normalized[i.code], 0)
    if (category.group === 'Technical') technical += sum; else behavioral += sum
  }
  const round1 = (n: number) => Math.round(n * 10) / 10
  return { technical: round1(technical), behavioral: round1(behavioral), total: round1(technical + behavioral), normalized }
}

// Upper-inclusive tiers matching the doc's stated ranges (0-23, 24-46, 47-69, 70-80, ...) —
// since scores here are continuous (not integer), each tier runs up through its stated max.
const matrix: { max: number; band: string; outcome: string }[] = [
  { max: 23, band: 'بحرانی', outcome: '۳۰٪ کسر حقوق' },
  { max: 46, band: 'ضعیف', outcome: '۲۰٪ کسر حقوق' },
  { max: 69, band: 'نیاز به بهبود', outcome: '۱۰٪ کسر حقوق' },
  { max: 80, band: 'استاندارد', outcome: 'بدون تغییر' },
  { max: 85, band: 'عالی (سطح ۲)', outcome: '۵,۰۰۰,۰۰۰ تومان پاداش' },
  { max: 90, band: 'عالی (سطح ۳)', outcome: '۱۰,۰۰۰,۰۰۰ تومان پاداش' },
  { max: 95, band: 'عالی (سطح ۴)', outcome: '۱۵,۰۰۰,۰۰۰ تومان پاداش' },
  { max: 100, band: 'استثنایی', outcome: '۲۵,۰۰۰,۰۰۰ تومان پاداش' },
]

export function matrixOutcome(score: number): { band: string; outcome: string } {
  const clamped = Math.max(0, Math.min(100, score))
  const tier = matrix.find((t) => clamped <= t.max) ?? matrix[matrix.length - 1]
  return { band: tier.band, outcome: tier.outcome }
}
