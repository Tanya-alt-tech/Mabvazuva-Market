/* ------------------------------------------------------------------
   Mabvazuva Market: settings.
   This is the only file you need to edit.
------------------------------------------------------------------- */
window.MM_CONFIG = {
  siteName: "Vazuva",

  // 1. DATABASE. Paste these two values from Supabase
  //    (Project Settings > API). While they are empty the site runs in
  //    preview mode with sample businesses saved on your own device only.
   supabaseUrl: "https://tduzkhfobaekauogqurw.supabase.co",
  supabaseKey: "sb_publishable_8G8RBazeZvwfG5LU8jp6iQ_DRhcAmaA",
  // 2. YOUR WHATSAPP, international format, digits only, e.g. "263771234567".
  //    New owners get a button to message you after they apply.
  adminWhatsApp: "0772 433 877",

  // 3. HOW BUSINESSES PAY YOU, shown to owners who pick a paid plan,
  //    e.g. "EcoCash 0771 234 567 (T. Masimo), or cash at house 14."
  //    Leave empty and owners are told you will WhatsApp them the details.
  
   paymentNote: "EcoCash 0772 433 877 (W. Magwenzi).",

  foundingSpots: 20,   // founding-member price for the first 20 paying businesses
  featuredSlots: 6,    // homepage feature slots (Premium only)

  plans: {
        premium: { name: "Premium", price: 25, founding: 20, photos: 8,
      line: "Be the first name neighbours see.",
      features: ["Business video on your listing", "Homepage feature slot", "Top of every search", "Verified resident badge", "8 photos and everything in Growth"] },
    growth:  { name: "Growth", price: 12, founding: 10, photos: 4,
      line: "Everything a busy local business needs.",
      features: ["Instagram, Facebook and TikTok links", "Up to 4 photos", "Post deals", "Collect reviews", "Weekly views and WhatsApp clicks", "Listed above Starter"] },
    starter: { name: "Starter", price: 0, founding: 0, photos: 1,
      line: "Get found. Free, for as long as you like.",
      features: ["Full listing with prices and hours", "1 photo", "WhatsApp button"] }
  }
};

window.MM_CATEGORIES = [
  { id: "lessons", name: "Lessons and tutoring" },
  { id: "food",    name: "Food and baking" },
  { id: "home",    name: "Home services" },
  { id: "beauty",  name: "Beauty" },
  { id: "cars",    name: "Cars" },
  { id: "fitness", name: "Fitness and sports" },
  { id: "kids",    name: "Kids" },
  { id: "events",  name: "Events" },
  { id: "pro",     name: "Professional services" },
  { id: "other",   name: "Everything else" }
];

window.MM_QUICK = ["Piano lessons", "Birthday cake", "Car wash", "Plumber", "Tutor"];

/* ------------------------------------------------------------------
   SAMPLE DATA. Used ONLY in preview mode (no database connected), so
   you can see how a full directory looks. None of it is shown once the
   database is connected. You never need to edit or delete it.
------------------------------------------------------------------- */
window.MM_SAMPLE = {
  businesses: [
    { id: "mai-tinos-bakes", name: "Mai Tino's Bakes", cat: "food", owner_name: "Rudo",
      plan: "premium", paid: true, verified: true, featured: true, daysAgo: 90, wa: "",
      tagline: "Celebration cakes and weekend bakes, made in Mabvazuva.",
      descr: "Custom birthday and wedding cakes, cupcakes by the dozen and fresh bread every Saturday morning. Order two days ahead for cakes. Collection from my kitchen or delivery inside the gate.",
      prices: [["Celebration cake (serves 20)", "$35"], ["Cupcakes, dozen", "$12"], ["Saturday sourdough loaf", "$4"]],
      hours: "Tue to Sat, 8am to 5pm",
      deal: "Order a celebration cake this month and get 6 cupcakes free.",
      hits: { view: [120, 141, 160, 184], wa: [19, 24, 27, 31] },
      reviews: [
        { name: "Rumbi M.", stars: 5, daysAgo: 6, body: "The cake for my daughter's 7th was beautiful and it was gone in ten minutes." },
        { name: "Tapiwa G.", stars: 5, daysAgo: 20, body: "Saturday bread is now a family tradition. Still warm when it arrives." },
        { name: "Nyasha K.", stars: 4, daysAgo: 48, body: "Lovely cupcakes. Order early, she books up fast." }
      ] },
    { id: "sparkle-bay", name: "Sparkle Bay Car Wash", cat: "cars", owner_name: "Blessing",
      plan: "premium", paid: true, verified: true, featured: true, daysAgo: 75, wa: "",
      tagline: "We come to your driveway. You keep your morning.",
      descr: "Mobile car wash and valet inside Mabvazuva. We bring our own water tank and power, so there is nothing for you to set up. Weekly and monthly plans available.",
      prices: [["Exterior wash", "$5"], ["Wash and vacuum", "$8"], ["Full valet", "$20"], ["Monthly plan, 4 washes", "$28"]],
      hours: "Mon to Sat, 7am to 5pm",
      deal: "First wash free when you start a monthly plan.",
      hits: { view: [130, 166, 181, 203], wa: [22, 30, 33, 38] },
      reviews: [
        { name: "Farai D.", stars: 5, daysAgo: 3, body: "On time every Friday and the car looks new. Worth every dollar." },
        { name: "Chipo N.", stars: 5, daysAgo: 25, body: "They washed both cars while I was on a call. Did not have to move." }
      ] },
    { id: "glow-by-ruva", name: "Glow by Ruva", cat: "beauty", owner_name: "Ruva",
      plan: "premium", paid: true, verified: true, featured: true, daysAgo: 60, wa: "",
      tagline: "Braids, nails and lashes without leaving the estate.",
      descr: "A small home studio with one chair, so you are never rushed. Knotless braids, gel nails, lash extensions and bridal packages. Evening slots for people who work late.",
      prices: [["Knotless braids", "from $25"], ["Gel manicure", "$15"], ["Classic lashes", "$20"], ["Bridal package", "from $80"]],
      hours: "Tue to Sun, 9am to 7pm", deal: "",
      hits: { view: [101, 122, 150, 167], wa: [18, 21, 25, 27] },
      reviews: [
        { name: "Tariro S.", stars: 5, daysAgo: 4, body: "Neatest braids I have had in years, and she is five minutes from my door." },
        { name: "Kudzai P.", stars: 4, daysAgo: 30, body: "Great nails. Book the evening slots early." }
      ] },
    { id: "fixit-farai", name: "FixIt Farai", cat: "home", owner_name: "Farai",
      plan: "growth", paid: true, verified: false, featured: false, daysAgo: 80, wa: "",
      tagline: "Plumbing, geysers and odd jobs, usually the same day.",
      descr: "Leaking taps, burst pipes, geyser repairs, hanging TVs and fitting shelves. I live in Mabvazuva so emergency call-outs are quick. Fixed quotes before I start.",
      prices: [["Call-out and assessment", "$20"], ["Tap or toilet repair", "from $15"], ["Geyser service", "$45"]],
      hours: "Mon to Sat, 7am to 6pm. Emergencies any time.",
      deal: "Free geyser check with any plumbing job this month.",
      hits: { view: [80, 92, 110, 121], wa: [14, 15, 19, 22] },
      reviews: [
        { name: "Mrs Moyo", stars: 5, daysAgo: 18, body: "Burst pipe at 9pm and he was here in fifteen minutes." },
        { name: "Simba C.", stars: 4, daysAgo: 55, body: "Fair price and tidy work." }
      ] },
    { id: "brightminds", name: "BrightMinds Tutoring", cat: "lessons", owner_name: "Mr Chirwa",
      plan: "growth", paid: true, verified: false, featured: false, daysAgo: 100, wa: "",
      tagline: "Maths and science for Form 1 to A level, at your dining table.",
      descr: "One-to-one and small group lessons for ZIMSEC and Cambridge. Fifteen years of classroom teaching. Exam revision blocks run every school holiday.",
      prices: [["One-to-one, per hour", "$12"], ["Group of 3, per learner", "$7"], ["Holiday revision week", "$60"]],
      hours: "Mon to Fri, 3pm to 7pm. Sat, 9am to 1pm", deal: "",
      hits: { view: [66, 71, 85, 98], wa: [9, 12, 13, 16] },
      reviews: [
        { name: "Mai Tadiwa", stars: 5, daysAgo: 22, body: "My son went from a D to a B in one term. Patient and clear." },
        { name: "Tendai R.", stars: 5, daysAgo: 85, body: "The holiday revision week was the best money we spent this year." }
      ] },
    { id: "skate-club", name: "Mabvazuva Skate Club", cat: "fitness", owner_name: "Coach Tawanda",
      plan: "growth", paid: true, verified: false, featured: false, daysAgo: 9, wa: "",
      tagline: "Roller skating lessons for ages 5 and up.",
      descr: "Beginner and intermediate skating on the smooth stretch by the park. Skates and pads are provided for the first month. Adults are welcome on Sunday mornings.",
      prices: [["Single lesson", "$8"], ["Month, 4 lessons", "$28"], ["Private lesson", "$15"]],
      hours: "Sat and Sun, 8am to 12pm. Wed, 4pm to 6pm",
      deal: "Bring a friend and you both skate for $5.",
      hits: { view: [0, 0, 97, 143], wa: [0, 0, 14, 19] },
      reviews: [
        { name: "Anesu B.", stars: 5, daysAgo: 2, body: "My twins talk about nothing else. Coach is brilliant with nervous kids." }
      ] },
    { id: "little-acorns", name: "Little Acorns Playgroup", cat: "kids", owner_name: "Teacher Grace",
      plan: "growth", paid: true, verified: false, featured: false, daysAgo: 120, wa: "",
      tagline: "A morning playgroup for ages 2 to 5, with a big garden.",
      descr: "Small groups of up to ten children, with a qualified early-years teacher and an assistant. Mornings of play, stories, music and a healthy snack. Aftercare by arrangement.",
      prices: [["Mornings, per month", "$90"], ["Drop-in morning", "$8"], ["Aftercare, per afternoon", "$5"]],
      hours: "Mon to Fri, 7:30am to 12:30pm", deal: "",
      hits: { view: [70, 74, 80, 87], wa: [8, 9, 9, 11] },
      reviews: [
        { name: "Vimbai T.", stars: 5, daysAgo: 50, body: "Our daughter runs in every morning. That says it all." },
        { name: "Daniel H.", stars: 4, daysAgo: 110, body: "Caring staff and a lovely garden." }
      ] },
    { id: "tendai-events", name: "Tendai Events and Decor", cat: "events", owner_name: "Tendai",
      plan: "growth", paid: false, verified: false, featured: false, daysAgo: 45, wa: "",
      tagline: "Tents, tables and styling for parties from 10 to 200 guests.",
      descr: "Garden parties, baby showers, graduations and kitchen parties. We supply the tent, chairs, linen and flowers, and take it all down the next morning.",
      prices: [["Kids party setup", "from $120"], ["Garden party, 50 guests", "from $350"], ["Chair and table hire, per guest", "$2"]],
      hours: "Daily, by appointment",
      deal: "Book a party a month ahead and save 10%.",
      hits: { view: [52, 60, 69, 76], wa: [5, 7, 8, 9] },
      reviews: [
        { name: "Rutendo M.", stars: 5, daysAgo: 28, body: "My mother's 60th looked like a magazine shoot." }
      ] },
    { id: "keys-with-kuda", name: "Keys with Kuda", cat: "lessons", owner_name: "Kuda",
      plan: "starter", paid: false, verified: false, featured: false, daysAgo: 5, wa: "",
      tagline: "Piano lessons for beginners, by a Grade 8 student.",
      descr: "Fun, patient lessons for children and adults who are just starting out. I come to your house if you have a piano or keyboard, or you can come to mine.",
      prices: [["30 minute lesson", "$6"], ["4 lessons, paid upfront", "$20"]],
      hours: "Weekdays after 3pm. Saturdays all day", deal: "",
      hits: { view: [0, 0, 0, 54], wa: [0, 0, 0, 7] }, reviews: [] },
    { id: "chiedza-accounting", name: "Chiedza Accounting", cat: "pro", owner_name: "Chiedza",
      plan: "starter", paid: false, verified: false, featured: false, daysAgo: 70, wa: "",
      tagline: "Bookkeeping and tax returns for small businesses.",
      descr: "Monthly bookkeeping, ZIMRA returns and company registration. I work with shop owners, contractors and home businesses.",
      prices: [["Monthly bookkeeping", "from $60"], ["Company registration", "$120"]],
      hours: "Mon to Fri, 8am to 5pm", deal: "",
      hits: { view: [30, 33, 39, 41], wa: [3, 2, 4, 4] }, reviews: [] },
    { id: "greenthumb", name: "GreenThumb Gardens", cat: "home", owner_name: "Lovemore",
      plan: "starter", paid: false, verified: false, featured: false, daysAgo: 65, wa: "",
      tagline: "Lawn care, hedges and garden clean-ups.",
      descr: "Weekly or fortnightly garden maintenance, once-off clean-ups and irrigation repairs. We bring our own tools and take the cuttings away.",
      prices: [["Fortnightly maintenance, per month", "$40"], ["Once-off clean-up", "from $25"]],
      hours: "Mon to Sat, 7am to 4pm", deal: "",
      hits: { view: [35, 40, 44, 49], wa: [4, 5, 5, 6] }, reviews: [] },
    { id: "pawpals", name: "PawPals Dog Walking", cat: "other", owner_name: "Tanaka and Nomsa",
      plan: "starter", paid: false, verified: false, featured: false, daysAgo: 4, wa: "",
      tagline: "Daily walks and holiday pet sitting.",
      descr: "Two sisters who love dogs. We walk in the mornings before school and in the late afternoon, and we feed and check on pets while you travel.",
      prices: [["30 minute walk", "$4"], ["Holiday visit, per day", "$6"]],
      hours: "Daily, 6am to 7am and 4pm to 6pm", deal: "",
      hits: { view: [0, 0, 0, 38], wa: [0, 0, 0, 5] }, reviews: [] }
  ],
  requests: [
    { id: "r1", need: "Someone to service two air conditioners before the heat gets worse", when_text: "This week", name: "Tafadzwa", cat: "home", replies: 2, daysAgo: 1 },
    { id: "r2", need: "Swimming lessons for a nervous 6 year old", when_text: "Weekends", name: "Mai Kupa", cat: "lessons", replies: 1, daysAgo: 2 },
    { id: "r3", need: "A photographer for a graduation lunch", when_text: "First Saturday of next month", name: "Brian", cat: "events", replies: 0, daysAgo: 3 },
    { id: "r4", need: "Somebody who can do school uniform alterations", when_text: "Before schools open", name: "Sekai", cat: "other", replies: 3, daysAgo: 5 }
  ],
  events: [
    { id: "e1", date_text: "Next Saturday", title: "Makers' morning market", detail: "Bakers, crafters and growers from inside the gate. 8am to 12pm at the park." },
    { id: "e2", date_text: "In three weeks", title: "Kids' skate jam", detail: "Hosted by Mabvazuva Skate Club. Free to watch, $3 to skate." }
  ]
};
