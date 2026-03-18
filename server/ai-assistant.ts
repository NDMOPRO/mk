import { invokeLLM } from "./_core/llm";
import * as db from "./db";
import { buildPublicKnowledge, KNOWLEDGE_VERSION } from "./ai/publicKnowledge";

// Build dynamic system prompt from CMS settings + knowledge base + documents
async function buildSystemPrompt(userRole: string): Promise<string> {
  // Get AI settings from CMS
  const aiName = await db.getSetting("ai.name") || "المفتاح الشهري الذكي";
  const aiNameEn = await db.getSetting("ai.nameEn") || "Monthly Key AI";
  const aiPersonality = await db.getSetting("ai.personality") || "professional_friendly";
  const aiWelcome = await db.getSetting("ai.welcomeMessage") || "مرحباً! أنا المفتاح الشهري الذكي، كيف أقدر أساعدك؟";
  const aiCustomInstructions = await db.getSetting("ai.customInstructions") || "";
  const aiMaxTokens = await db.getSetting("ai.maxResponseLength") || "800";
  const aiEnabled = await db.getSetting("ai.enabled") || "true";

  if (aiEnabled !== "true") {
    return "أنت مساعد معطل حالياً. أخبر المستخدم أن المساعد الذكي غير متاح حالياً وسيعود قريباً.";
  }

  // Get live platform stats for context
  let platformContext = "";
  try {
    const propCount = await db.getPropertyCount("active");
    const bookingCount = await db.getBookingCount();
    platformContext = `
## إحصائيات المنصة الحالية (للاستخدام عند السؤال):
- عدد العقارات المتاحة: ${propCount || 0}
- عدد الحجوزات: ${bookingCount || 0}
- المدن المتاحة: الرياض، جدة، الدمام، مكة، المدينة، الخبر، أبها، تبوك`;
  } catch { /* stats are optional context */ }

  // Get uploaded documents context
  let documentsContext = "";
  try {
    const docs = await db.getActiveAiDocumentTexts();
    if (docs.length > 0) {
      documentsContext = "\n\n## مستندات مرجعية مرفوعة من الإدارة:\n";
      for (const doc of docs.slice(0, 10)) {
        const desc = doc.descriptionAr || doc.description || doc.filename;
        const text = doc.extractedText?.substring(0, 2000) || "";
        if (text) {
          documentsContext += `### ${desc}\n${text}\n\n`;
        }
      }
    }
  } catch { /* documents are optional context */ }

  // Get active knowledge base articles
  let knowledgeContext = "";
  try {
    const articles = await db.getKnowledgeArticles();
    if (articles.length > 0) {
      knowledgeContext = "\n\n## قاعدة المعرفة / Knowledge Base:\n";
      for (const article of articles.slice(0, 15)) {
        knowledgeContext += `### ${article.titleAr} / ${article.titleEn}\n${article.contentAr}\n${article.contentEn}\n\n`;
      }
    }
  } catch { /* knowledge is optional context */ }

  // Personality mapping
  const personalityMap: Record<string, string> = {
    professional_friendly: "محترف وودود / Professional & Friendly — ترد بأسلوب مهني لكن بلمسة ودية وتستخدم إيموجي باعتدال. Respond professionally with a friendly touch and moderate emoji use.",
    formal: "رسمي / Formal — ترد بأسلوب رسمي ومهني بدون إيموجي. Respond in a formal, professional manner without emoji.",
    casual_saudi: "عامي سعودي / Casual Saudi — ترد بلهجة سعودية عامية مفهومة وودودة. When user writes in English, respond in casual friendly English.",
    helpful_detailed: "مفصّل ومساعد / Helpful & Detailed — تقدم شروحات مفصلة خطوة بخطوة. Provide detailed step-by-step explanations.",
  };
  const personalityDesc = personalityMap[aiPersonality] || personalityMap.professional_friendly;

  // Role-specific context
  let roleContext = "";
  if (userRole === "tenant") {
    roleContext = "\n\nالمستخدم الحالي هو مستأجر. ركز على إرشادات المستأجرين: البحث عن عقار، الحجز، الصيانة، المدفوعات. / Current user is a tenant. Focus on tenant guidance: property search, booking, maintenance, payments.";
  } else if (userRole === "landlord") {
    roleContext = "\n\nالمستخدم الحالي هو مالك عقار. ركز على إرشادات الملاك: إدارة العقارات، طلبات الحجز، الصيانة، الإيرادات. / Current user is a landlord. Focus on landlord guidance: property management, booking requests, maintenance, revenue.";
  } else if (userRole === "admin") {
    roleContext = "\n\nالمستخدم الحالي هو مدير المنصة. ركز على إرشادات الإدارة: الإحصائيات، المستخدمين، الموافقات، الإعدادات. / Current user is a platform admin. Focus on admin guidance: statistics, users, approvals, settings.";
  }

  return `أنت "${aiName}" (${aiNameEn}) — المساعد الذكي الرسمي لمنصة المفتاح الشهري للإيجار الشهري في المملكة العربية السعودية.

## هويتك
- اسمك: ${aiName} (${aiNameEn})
- شخصيتك: ${personalityDesc}
- رسالة الترحيب: "${aiWelcome}"
- تفهم جميع اللهجات العربية (سعودية، مصرية، خليجية، شامية، مغربية) والإنجليزية
- ترد بنفس لغة المستخدم — إذا كتب بالعربية ترد بالعربية، وإذا كتب بالإنجليزية ترد بالإنجليزية
- إذا كتب بلهجة سعودية ترد بلهجة سعودية مفهومة
- الحد الأقصى لطول ردك: ${aiMaxTokens} كلمة تقريباً

## معرفتك الكاملة بالمنصة

### للمستأجرين (Tenants):
1. **البحث عن عقار**: استخدم صفحة البحث — فلتر بالمدينة، السعر، النوع (شقة، فيلا، استوديو، دوبلكس، غرفة مفروشة، كمباوند، شقة فندقية)، عدد الغرف، الحمامات، مستوى التأثيث
2. **تفاصيل العقار**: اضغط على أي عقار لرؤية الصور، الموقع على الخريطة، المرافق، قواعد السكن، السعر الشهري، التأمين
3. **الحجز**: اضغط "احجز الآن" → اختر تاريخ الدخول والمدة → راجع التكلفة (إيجار + تأمين + رسوم خدمة 5%) → أكد الحجز
4. **لوحة التحكم**: من "لوحة التحكم" تشوف حجوزاتك، مدفوعاتك، مفضلاتك، طلبات الصيانة، الإشعارات
5. **المفضلة**: اضغط قلب ❤️ على أي عقار لحفظه في المفضلة
6. **الرسائل**: تواصل مع المالك مباشرة من صفحة العقار أو من قسم الرسائل
7. **طلب صيانة**: من لوحة التحكم → طلبات الصيانة → طلب جديد → اختر العقار والفئة والأولوية → أرفق صور
8. **طلب معاينة**: من صفحة العقار → "طلب معاينة" → اختر التاريخ والوقت
9. **حاسبة التكاليف**: من صفحة العقار → "حاسبة التكاليف" لحساب التكلفة الإجمالية مع الضريبة والتأمين
10. **الخدمات**: طلب خدمات إضافية (تنظيف، صيانة، أثاث، نقل) من قسم الخدمات

### للملاك (Landlords):
1. **إضافة عقار**: اضغط "أضف عقارك" → املأ البيانات بالعربي والإنجليزي → ارفع الصور → أرسل للمراجعة
2. **إدارة العقارات**: من لوحة التحكم → عقاراتي → حالة كل عقار (مسودة، قيد المراجعة، نشط، غير نشط)
3. **طلبات الحجز**: قبول أو رفض مع ذكر السبب
4. **الصيانة**: استلام الطلب → بدء العمل → إكمال الصيانة
5. **المدفوعات**: متابعة الإيرادات والمدفوعات
6. **التواصل**: الرد على رسائل المستأجرين
7. **مدير العقار**: تعيين مدير عقار للتواصل مع المستأجرين

### لمدراء المنصة (Admins):
1. **لوحة الإدارة**: إحصائيات شاملة + رسوم بيانية
2. **إدارة المستخدمين**: عرض، تعديل أدوار، صلاحيات
3. **الموافقة على العقارات**: مراجعة → موافقة/رفض
4. **إدارة الحجوزات**: متابعة جميع الحجوزات
5. **قاعدة المعرفة**: إضافة وتعديل مقالات
6. **إعدادات CMS**: تخصيص المنصة بالكامل
7. **إدارة المدن والأحياء**: إضافة وتعديل المدن والأحياء السعودية
8. **طوارئ الصيانة**: متابعة طلبات الصيانة الطارئة
9. **التحكم بالمساعد الذكي**: تعديل الاسم، الشخصية، قاعدة المعرفة، رفع مستندات

### معلومات عامة:
- **العملة**: ريال سعودي (SAR)
- **رسوم الخدمة**: 5% من قيمة الإيجار
- **ضريبة القيمة المضافة**: 15%
- **المدن المتاحة**: الرياض، جدة، الدمام، مكة، المدينة، الخبر، أبها، تبوك، وغيرها
- **أنواع العقارات**: شقة، فيلا، استوديو، دوبلكس، غرفة مفروشة، كمباوند، شقة فندقية
- **اللغات**: عربي (افتراضي) وإنجليزي
${platformContext}${documentsContext}${knowledgeContext}${roleContext}

## معرفة المنصة المحدّثة (${KNOWLEDGE_VERSION}):
${buildPublicKnowledge()}

${aiCustomInstructions ? `## تعليمات إضافية من الإدارة:\n${aiCustomInstructions}\n` : ""}

## قواعد الرد:
1. رد بشكل مختصر ومفيد — لا تطول بدون فائدة
2. إذا السؤال عن شيء خارج المنصة، قل "هذا خارج نطاق تخصصي، أنا متخصص في منصة المفتاح الشهري فقط"
3. إذا المستخدم يحتاج مساعدة تقنية، وجهه للخطوات بالتفصيل
4. استخدم أمثلة عملية عند الشرح
5. إذا المستخدم غاضب أو محبط، تعامل بلطف واحترافية
6. لا تخترع معلومات — إذا ما تعرف قل "ما عندي معلومة عن هذا، تواصل مع الدعم"
7. عند ذكر أرقام أو إحصائيات، استخدم البيانات الحقيقية من إحصائيات المنصة أعلاه`;
}

export async function getAiResponse(
  userId: number,
  conversationId: number,
  userMessage: string,
  userRole: string,
) {
  // Build dynamic system prompt with all context
  const systemPrompt = await buildSystemPrompt(userRole);

  // Get conversation history
  const history = await db.getAiMessages(conversationId);

  // Search knowledge base for relevant articles specific to this query
  const kbArticles = await db.searchKnowledgeBase(userMessage);
  
  let queryContext = "";
  if (kbArticles.length > 0) {
    queryContext = "\n\n## نتائج بحث ذات صلة / Relevant search results:\n";
    for (const article of kbArticles.slice(0, 3)) {
      queryContext += `### ${article.titleAr} / ${article.titleEn}\n${article.contentAr}\n${article.contentEn}\n\n`;
    }
  }

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt + queryContext },
  ];

  // Add conversation history (last 20 messages for context)
  const recentHistory = history.slice(-20);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    });
  }

  // Add current user message
  messages.push({ role: "user", content: userMessage });

  const response = await invokeLLM({ messages });
  
  const assistantContent = typeof response.choices[0].message.content === "string"
    ? response.choices[0].message.content
    : (response.choices[0].message.content as any[]).map((c: any) => c.text || "").join("");

  return assistantContent;
}

export async function seedDefaultKnowledgeBase() {
  const existing = await db.getAllKnowledgeArticles();
  if (existing.length > 0) return;

  const articles = [
    // === FAQ ===
    {
      category: "faq" as const,
      titleEn: "How to search for a property?",
      titleAr: "كيف أبحث عن عقار؟",
      contentEn: "Go to the Search page from the navigation bar. Use filters to narrow down by city, price range, property type (apartment, villa, studio, duplex, furnished room, compound, hotel apartment), number of bedrooms/bathrooms, and furnishing level. You can switch between grid and list views, or use the map view to find properties by location.",
      contentAr: "اذهب لصفحة البحث من شريط التنقل. استخدم الفلاتر للتصفية حسب المدينة، نطاق السعر، نوع العقار (شقة، فيلا، استوديو، دوبلكس، غرفة مفروشة، كمباوند، شقة فندقية)، عدد الغرف/الحمامات، ومستوى التأثيث. يمكنك التبديل بين عرض الشبكة والقائمة، أو استخدام عرض الخريطة للبحث حسب الموقع.",
      tags: ["search", "filter", "بحث", "فلتر", "عقار"],
    },
    {
      category: "faq" as const,
      titleEn: "How to book a property?",
      titleAr: "كيف أحجز عقار؟",
      contentEn: "1. Find a property you like on the Search page. 2. Click 'Book Now' on the property page. 3. Select your move-in date and rental duration in months. 4. Review the cost breakdown (monthly rent + security deposit + 5% service fee). 5. Confirm your booking and wait for landlord approval.",
      contentAr: "1. ابحث عن عقار يعجبك في صفحة البحث. 2. اضغط 'احجز الآن' في صفحة العقار. 3. اختر تاريخ الدخول ومدة الإيجار بالأشهر. 4. راجع تفاصيل التكلفة (إيجار شهري + تأمين + رسوم خدمة 5%). 5. أكد الحجز وانتظر موافقة المالك.",
      tags: ["booking", "حجز", "إيجار", "rent"],
    },
    {
      category: "faq" as const,
      titleEn: "How to submit a maintenance request?",
      titleAr: "كيف أرسل طلب صيانة؟",
      contentEn: "Go to your Dashboard > Maintenance tab > New Request. Select the property, choose a category (plumbing, electrical, HVAC, appliance, structural, pest control, cleaning, other), set priority level (low, medium, high, emergency), describe the issue in detail, and attach photos if needed.",
      contentAr: "اذهب للوحة التحكم > تبويب الصيانة > طلب جديد. اختر العقار، اختر الفئة (سباكة، كهرباء، تكييف، أجهزة، هيكلي، مكافحة حشرات، تنظيف، أخرى)، حدد مستوى الأولوية (منخفضة، متوسطة، عالية، طارئة)، اوصف المشكلة بالتفصيل، وأرفق صور إذا لزم الأمر.",
      tags: ["maintenance", "صيانة", "طلب", "request"],
    },
    {
      category: "faq" as const,
      titleEn: "What are the service fees?",
      titleAr: "ما هي رسوم الخدمة؟",
      contentEn: "Monthly Key charges a 5% service fee on the monthly rent. Additionally, a 15% VAT (Value Added Tax) applies as per Saudi regulations. The security deposit is fully refundable upon checkout after property inspection. Service fees are non-refundable.",
      contentAr: "يفرض المفتاح الشهري رسوم خدمة بنسبة 5% من قيمة الإيجار الشهري. بالإضافة إلى ضريبة القيمة المضافة 15% حسب أنظمة المملكة. مبلغ التأمين قابل للاسترداد بالكامل عند المغادرة بعد فحص العقار. رسوم الخدمة غير قابلة للاسترداد.",
      tags: ["fees", "رسوم", "service", "خدمة", "vat", "ضريبة"],
    },
    {
      category: "faq" as const,
      titleEn: "What property types are available?",
      titleAr: "ما أنواع العقارات المتاحة؟",
      contentEn: "Monthly Key offers seven property types: Apartment, Villa, Studio, Duplex, Furnished Room, Compound, and Hotel Apartment. Each property listing includes details about size, furnishing level, amenities, location, and pricing.",
      contentAr: "يوفر المفتاح الشهري سبعة أنواع من العقارات: شقة، فيلا، استوديو، دوبلكس، غرفة مفروشة، كمباوند (مجمع سكني)، وشقة فندقية. كل إعلان عقار يتضمن تفاصيل عن المساحة، مستوى التأثيث، المرافق، الموقع، والأسعار.",
      tags: ["types", "أنواع", "property", "عقار"],
    },
    {
      category: "faq" as const,
      titleEn: "Which cities are available?",
      titleAr: "ما المدن المتاحة؟",
      contentEn: "Currently, Monthly Key serves Riyadh with multiple districts available. Jeddah and Madinah are coming soon. The platform is expanding to cover more cities across Saudi Arabia including Dammam, Makkah, Khobar, Abha, and Tabuk.",
      contentAr: "حالياً، يخدم المفتاح الشهري مدينة الرياض مع عدة أحياء متاحة. جدة والمدينة المنورة قادمتان قريباً. المنصة تتوسع لتغطي مدن أكثر في المملكة العربية السعودية مثل الدمام، مكة، الخبر، أبها، وتبوك.",
      tags: ["cities", "مدن", "riyadh", "الرياض", "location"],
    },
    {
      category: "faq" as const,
      titleEn: "How to contact the landlord?",
      titleAr: "كيف أتواصل مع المالك؟",
      contentEn: "You can contact the landlord directly from the property page by clicking the 'Contact Landlord' button. You can also use the Messages section in your dashboard to view and manage all your conversations with landlords.",
      contentAr: "يمكنك التواصل مع المالك مباشرة من صفحة العقار بالضغط على زر 'تواصل مع المالك'. كما يمكنك استخدام قسم الرسائل في لوحة التحكم لعرض وإدارة جميع محادثاتك مع الملاك.",
      tags: ["contact", "تواصل", "landlord", "مالك", "messages", "رسائل"],
    },
    {
      category: "faq" as const,
      titleEn: "How to save a property to favorites?",
      titleAr: "كيف أحفظ عقار في المفضلة؟",
      contentEn: "Click the heart icon on any property card or property detail page to save it to your favorites. You can view all your saved properties from the Favorites tab in your dashboard.",
      contentAr: "اضغط على أيقونة القلب في أي بطاقة عقار أو صفحة تفاصيل العقار لحفظه في المفضلة. يمكنك عرض جميع العقارات المحفوظة من تبويب المفضلة في لوحة التحكم.",
      tags: ["favorites", "مفضلة", "save", "حفظ"],
    },
    {
      category: "faq" as const,
      titleEn: "How to create an account?",
      titleAr: "كيف أنشئ حساب؟",
      contentEn: "Click 'Register' from the navigation bar. Fill in your details (name in Arabic and English, email, phone number, password). Choose your role: Tenant or Landlord. Complete phone verification via OTP, then email verification. Your account will be ready to use immediately.",
      contentAr: "اضغط 'إنشاء حساب' من شريط التنقل. املأ بياناتك (الاسم بالعربي والإنجليزي، البريد الإلكتروني، رقم الجوال، كلمة المرور). اختر دورك: مستأجر أو مالك عقار. أكمل تحقق الجوال عبر رمز OTP، ثم تحقق البريد الإلكتروني. حسابك سيكون جاهز للاستخدام فوراً.",
      tags: ["register", "تسجيل", "account", "حساب", "signup"],
    },
    {
      category: "faq" as const,
      titleEn: "How to request a property viewing?",
      titleAr: "كيف أطلب معاينة عقار؟",
      contentEn: "From the property detail page, click 'Request Viewing'. Choose your preferred date and time. The landlord will receive your request and confirm or suggest an alternative time.",
      contentAr: "من صفحة تفاصيل العقار، اضغط 'طلب معاينة'. اختر التاريخ والوقت المناسب لك. سيستلم المالك طلبك ويؤكد أو يقترح وقت بديل.",
      tags: ["viewing", "معاينة", "inspection", "زيارة"],
    },
    // === TENANT GUIDE ===
    {
      category: "tenant_guide" as const,
      titleEn: "Tenant Guide: Getting Started",
      titleAr: "دليل المستأجر: البداية",
      contentEn: "Welcome to Monthly Key! As a tenant, you can: search properties by city, type, and price; save favorites for later; book with a simple 5-step process; communicate directly with landlords via messaging; submit maintenance requests with photo attachments; track all your payments and booking history from your personal dashboard.",
      contentAr: "مرحباً بك في المفتاح الشهري! كمستأجر، يمكنك: البحث عن العقارات حسب المدينة والنوع والسعر، حفظ المفضلات للرجوع إليها لاحقاً، الحجز بعملية بسيطة من 5 خطوات، التواصل مباشرة مع الملاك عبر الرسائل، إرسال طلبات صيانة مع إرفاق صور، ومتابعة جميع مدفوعاتك وسجل حجوزاتك من لوحة التحكم الشخصية.",
      tags: ["tenant", "guide", "مستأجر", "دليل", "getting started"],
    },
    {
      category: "tenant_guide" as const,
      titleEn: "Tenant Guide: Understanding Costs",
      titleAr: "دليل المستأجر: فهم التكاليف",
      contentEn: "When booking a property, the total cost includes: Monthly Rent (set by the landlord), Security Deposit (refundable upon checkout after inspection), Service Fee (5% of monthly rent, non-refundable), and VAT (15%). Use the Cost Calculator on any property page to estimate your total costs before booking.",
      contentAr: "عند حجز عقار، التكلفة الإجمالية تشمل: الإيجار الشهري (يحدده المالك)، مبلغ التأمين (قابل للاسترداد عند المغادرة بعد الفحص)، رسوم الخدمة (5% من الإيجار الشهري، غير قابلة للاسترداد)، وضريبة القيمة المضافة (15%). استخدم حاسبة التكاليف في أي صفحة عقار لتقدير تكاليفك الإجمالية قبل الحجز.",
      tags: ["costs", "تكاليف", "pricing", "أسعار", "deposit", "تأمين"],
    },
    {
      category: "tenant_guide" as const,
      titleEn: "Tenant Guide: Dashboard Features",
      titleAr: "دليل المستأجر: ميزات لوحة التحكم",
      contentEn: "Your tenant dashboard includes: Active Bookings (view current and past bookings), Payments (track payment history and upcoming dues), Favorites (saved properties), Maintenance (submit and track repair requests), Messages (communicate with landlords), and Notifications (booking updates, payment reminders, maintenance status).",
      contentAr: "لوحة تحكم المستأجر تشمل: الحجوزات النشطة (عرض الحجوزات الحالية والسابقة)، المدفوعات (متابعة سجل المدفوعات والمستحقات القادمة)، المفضلة (العقارات المحفوظة)، الصيانة (إرسال ومتابعة طلبات الإصلاح)، الرسائل (التواصل مع الملاك)، والإشعارات (تحديثات الحجز، تذكيرات الدفع، حالة الصيانة).",
      tags: ["dashboard", "لوحة تحكم", "features", "ميزات"],
    },
    // === LANDLORD GUIDE ===
    {
      category: "landlord_guide" as const,
      titleEn: "Landlord Guide: Listing Your Property",
      titleAr: "دليل المالك: إدراج عقارك",
      contentEn: "To list a property: 1. Click 'Add Property' from the menu. 2. Fill in all details in both Arabic and English (title, description, type, size, rooms, bathrooms). 3. Set monthly rent and security deposit. 4. Upload high-quality photos (minimum 3, recommended 8+). 5. Set amenities, utilities, and house rules. 6. Mark location on the map. 7. Submit for admin review. Once approved, your property will be visible to tenants.",
      contentAr: "لإدراج عقار: 1. اضغط 'أضف عقارك' من القائمة. 2. املأ جميع التفاصيل بالعربي والإنجليزي (العنوان، الوصف، النوع، المساحة، الغرف، الحمامات). 3. حدد الإيجار الشهري ومبلغ التأمين. 4. ارفع صور عالية الجودة (3 كحد أدنى، 8+ مستحسن). 5. حدد المرافق والخدمات المشمولة وقواعد السكن. 6. حدد الموقع على الخريطة. 7. أرسل للمراجعة من الإدارة. بعد الموافقة سيظهر عقارك للمستأجرين.",
      tags: ["landlord", "listing", "مالك", "إدراج", "property"],
    },
    {
      category: "landlord_guide" as const,
      titleEn: "Landlord Guide: Managing Bookings",
      titleAr: "دليل المالك: إدارة الحجوزات",
      contentEn: "When a tenant submits a booking request, you will receive a notification. From your dashboard, you can: Accept the booking (tenant will be notified to proceed with payment), Reject the booking (provide a reason for rejection), View tenant profile and history, Communicate with the tenant via messages before making a decision.",
      contentAr: "عندما يرسل مستأجر طلب حجز، ستصلك إشعار. من لوحة التحكم، يمكنك: قبول الحجز (سيتم إبلاغ المستأجر للمتابعة بالدفع)، رفض الحجز (مع ذكر سبب الرفض)، عرض ملف المستأجر وسجله، التواصل مع المستأجر عبر الرسائل قبل اتخاذ القرار.",
      tags: ["landlord", "bookings", "مالك", "حجوزات", "manage"],
    },
    {
      category: "landlord_guide" as const,
      titleEn: "Landlord Guide: Handling Maintenance",
      titleAr: "دليل المالك: التعامل مع الصيانة",
      contentEn: "When a tenant submits a maintenance request, you will be notified. The workflow is: 1. Receive the request (view details, photos, priority). 2. Acknowledge the request. 3. Start work (update status to 'In Progress'). 4. Complete the maintenance (update status to 'Completed'). Emergency requests (plumbing leaks, electrical issues) should be addressed within 24 hours.",
      contentAr: "عندما يرسل مستأجر طلب صيانة، ستصلك إشعار. سير العمل: 1. استلام الطلب (عرض التفاصيل والصور والأولوية). 2. تأكيد استلام الطلب. 3. بدء العمل (تحديث الحالة إلى 'قيد التنفيذ'). 4. إكمال الصيانة (تحديث الحالة إلى 'مكتمل'). الطلبات الطارئة (تسريبات سباكة، مشاكل كهربائية) يجب معالجتها خلال 24 ساعة.",
      tags: ["landlord", "maintenance", "مالك", "صيانة"],
    },
    // === ADMIN GUIDE ===
    {
      category: "admin_guide" as const,
      titleEn: "Admin Guide: Platform Overview",
      titleAr: "دليل المشرف: نظرة عامة على المنصة",
      contentEn: "The admin dashboard provides a comprehensive overview of the platform including: total users, active properties, pending approvals, booking statistics, revenue charts, and recent activity. Use the sidebar to navigate between sections: Properties, Operations, Marketing, Analytics, and System settings.",
      contentAr: "لوحة تحكم المشرف توفر نظرة شاملة على المنصة تشمل: إجمالي المستخدمين، العقارات النشطة، الموافقات المعلقة، إحصائيات الحجوزات، رسوم بيانية للإيرادات، والنشاط الأخير. استخدم القائمة الجانبية للتنقل بين الأقسام: العقارات، العمليات، التسويق، التحليلات، وإعدادات النظام.",
      tags: ["admin", "مشرف", "dashboard", "لوحة تحكم"],
    },
    {
      category: "admin_guide" as const,
      titleEn: "Admin Guide: Property Approval Process",
      titleAr: "دليل المشرف: عملية الموافقة على العقارات",
      contentEn: "When a landlord submits a property, it appears in the Submissions section. Review the property details, photos, pricing, and location. You can: Approve (property becomes visible to tenants), Reject (provide feedback to the landlord), or Request Changes (ask for specific modifications before approval).",
      contentAr: "عندما يرسل مالك عقاراً، يظهر في قسم طلبات إضافة عقار. راجع تفاصيل العقار والصور والأسعار والموقع. يمكنك: الموافقة (العقار يصبح مرئياً للمستأجرين)، الرفض (تقديم ملاحظات للمالك)، أو طلب تعديلات (طلب تعديلات محددة قبل الموافقة).",
      tags: ["admin", "approval", "مشرف", "موافقة", "submissions"],
    },
    // === POLICY ===
    {
      category: "policy" as const,
      titleEn: "Cancellation Policy",
      titleAr: "سياسة الإلغاء",
      contentEn: "Before landlord approval: Free cancellation, no charges. After landlord approval: Cancellation is subject to lease agreement terms. Security deposit: Fully refundable upon checkout after property inspection confirms no damage. Service fees (5%): Non-refundable under all circumstances. To cancel, go to your Dashboard > Bookings > select the booking > Cancel.",
      contentAr: "قبل موافقة المالك: إلغاء مجاني بدون رسوم. بعد موافقة المالك: الإلغاء يخضع لشروط عقد الإيجار. مبلغ التأمين: قابل للاسترداد بالكامل عند المغادرة بعد فحص العقار والتأكد من عدم وجود أضرار. رسوم الخدمة (5%): غير قابلة للاسترداد تحت أي ظرف. للإلغاء، اذهب للوحة التحكم > الحجوزات > اختر الحجز > إلغاء.",
      tags: ["cancellation", "policy", "إلغاء", "سياسة", "refund", "استرداد"],
    },
    {
      category: "policy" as const,
      titleEn: "Privacy Policy Summary",
      titleAr: "ملخص سياسة الخصوصية",
      contentEn: "Monthly Key collects personal information (name, email, phone, ID) to provide rental services. Your data is used for: account management, booking processing, communication between tenants and landlords, payment processing, and platform improvement. We do not sell your data to third parties. You can request data deletion by contacting support.",
      contentAr: "يجمع المفتاح الشهري معلومات شخصية (الاسم، البريد الإلكتروني، الجوال، الهوية) لتقديم خدمات الإيجار. بياناتك تُستخدم لـ: إدارة الحساب، معالجة الحجوزات، التواصل بين المستأجرين والملاك، معالجة المدفوعات، وتحسين المنصة. لا نبيع بياناتك لأطراف ثالثة. يمكنك طلب حذف بياناتك بالتواصل مع الدعم.",
      tags: ["privacy", "خصوصية", "data", "بيانات", "policy"],
    },
    {
      category: "policy" as const,
      titleEn: "Terms of Service Summary",
      titleAr: "ملخص الشروط والأحكام",
      contentEn: "By using Monthly Key, you agree to: provide accurate personal information, maintain the rented property in good condition, pay rent and fees on time, follow house rules set by the landlord, report maintenance issues promptly, and not sublease without landlord permission. Violation of terms may result in account suspension.",
      contentAr: "باستخدام المفتاح الشهري، توافق على: تقديم معلومات شخصية صحيحة، المحافظة على العقار المستأجر بحالة جيدة، دفع الإيجار والرسوم في وقتها، اتباع قواعد السكن المحددة من المالك، الإبلاغ عن مشاكل الصيانة فوراً، وعدم التأجير من الباطن بدون إذن المالك. مخالفة الشروط قد تؤدي لتعليق الحساب.",
      tags: ["terms", "شروط", "conditions", "أحكام"],
    },
    // === TROUBLESHOOTING ===
    {
      category: "troubleshooting" as const,
      titleEn: "Common Issues and Solutions",
      titleAr: "مشاكل شائعة وحلولها",
      contentEn: "Can't find properties? Try expanding your search filters or changing the city. Booking rejected? Contact the landlord via messages to understand the reason. Payment issues? Verify your payment method and try again. Can't upload photos? Ensure files are under 5MB in JPG or PNG format. Forgot password? Use the 'Forgot Password' link on the login page.",
      contentAr: "ما تلقى عقارات؟ جرب توسيع فلاتر البحث أو تغيير المدينة. الحجز مرفوض؟ تواصل مع المالك عبر الرسائل لمعرفة السبب. مشكلة في الدفع؟ تأكد من طريقة الدفع وحاول مرة ثانية. ما تقدر ترفع صور؟ تأكد إن الملفات أقل من 5 ميقا بصيغة JPG أو PNG. نسيت كلمة المرور؟ استخدم رابط 'نسيت كلمة المرور' في صفحة تسجيل الدخول.",
      tags: ["troubleshooting", "issues", "مشاكل", "حلول", "help"],
    },
    {
      category: "troubleshooting" as const,
      titleEn: "Account and Login Issues",
      titleAr: "مشاكل الحساب وتسجيل الدخول",
      contentEn: "Can't log in? Make sure you're using the correct username and password. Password must be at least 7 characters with uppercase, lowercase, number, and special character. If you forgot your password, click 'Forgot Password' on the login page and follow the reset instructions. If your account is suspended, contact support for assistance.",
      contentAr: "ما تقدر تسجل دخول؟ تأكد إنك تستخدم اسم المستخدم وكلمة المرور الصحيحة. كلمة المرور لازم تكون 7 أحرف على الأقل مع حرف كبير وصغير ورقم ورمز خاص. إذا نسيت كلمة المرور، اضغط 'نسيت كلمة المرور' في صفحة تسجيل الدخول واتبع تعليمات إعادة التعيين. إذا حسابك معلق، تواصل مع الدعم للمساعدة.",
      tags: ["login", "دخول", "password", "كلمة مرور", "account", "حساب"],
    },
    // === GENERAL ===
    {
      category: "general" as const,
      titleEn: "About Monthly Key",
      titleAr: "عن المفتاح الشهري",
      contentEn: "Monthly Key is Saudi Arabia's leading monthly rental platform. We connect tenants with quality furnished properties for monthly rentals across the Kingdom. Our platform supports both Arabic and English, offers dark/light mode, and is fully mobile-responsive. We ensure property quality through admin review and provide secure communication between tenants and landlords.",
      contentAr: "المفتاح الشهري هو المنصة الرائدة للإيجار الشهري في المملكة العربية السعودية. نربط المستأجرين بعقارات مفروشة عالية الجودة للإيجار الشهري في أنحاء المملكة. منصتنا تدعم العربية والإنجليزية، توفر الوضع الليلي والنهاري، ومتوافقة بالكامل مع الجوال. نضمن جودة العقارات من خلال مراجعة الإدارة ونوفر تواصل آمن بين المستأجرين والملاك.",
      tags: ["about", "عن", "monthly key", "المفتاح الشهري", "platform"],
    },
    {
      category: "general" as const,
      titleEn: "Payment Methods",
      titleAr: "طرق الدفع",
      contentEn: "Monthly Key currently supports bank transfer as the primary payment method. Credit card payments are coming soon. All payments are in Saudi Riyals (SAR). Payment receipts are available in your dashboard under the Payments section. For payment disputes, contact our support team.",
      contentAr: "يدعم المفتاح الشهري حالياً التحويل البنكي كطريقة دفع رئيسية. الدفع بالبطاقة الائتمانية قادم قريباً. جميع المدفوعات بالريال السعودي (SAR). إيصالات الدفع متاحة في لوحة التحكم تحت قسم المدفوعات. لأي نزاعات في الدفع، تواصل مع فريق الدعم.",
      tags: ["payment", "دفع", "bank", "بنك", "money", "فلوس"],
    },
    {
      category: "general" as const,
      titleEn: "Additional Services",
      titleAr: "خدمات إضافية",
      contentEn: "Monthly Key offers additional services including: Professional Cleaning (one-time or recurring), Maintenance Services (plumbing, electrical, HVAC), Furniture Rental (temporary furnishing solutions), and Moving Services (help with relocation). Request these services from the Services section in your dashboard.",
      contentAr: "يوفر المفتاح الشهري خدمات إضافية تشمل: التنظيف الاحترافي (مرة واحدة أو دوري)، خدمات الصيانة (سباكة، كهرباء، تكييف)، تأجير الأثاث (حلول تأثيث مؤقتة)، وخدمات النقل (المساعدة في الانتقال). اطلب هذه الخدمات من قسم الخدمات في لوحة التحكم.",
      tags: ["services", "خدمات", "cleaning", "تنظيف", "moving", "نقل"],
    },
  ];

  for (const article of articles) {
    await db.createKnowledgeArticle(article);
  }
}
