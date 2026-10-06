"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const env_1 = require("../config/env");
const User_1 = require("../models/User");
const Category_1 = require("../models/Category");
const Book_1 = require("../models/Book");
const Chapter_1 = require("../models/Chapter");
const Page_1 = require("../models/Page");
const Order_1 = require("../models/Order");
const ReadingProgress_1 = require("../models/ReadingProgress");
const Bookmark_1 = require("../models/Bookmark");
const Review_1 = require("../models/Review");
const seedDatabase = async () => {
    try {
        console.log('[Seeder] Connecting to MongoDB...');
        await mongoose_1.default.connect(env_1.config.mongoUri);
        console.log('[Seeder] Connected successfully.');
        console.log('[Seeder] Clearing old data...');
        await Promise.all([
            User_1.User.deleteMany({}),
            Category_1.Category.deleteMany({}),
            Book_1.Book.deleteMany({}),
            Chapter_1.Chapter.deleteMany({}),
            Page_1.Page.deleteMany({}),
            Order_1.Order.deleteMany({}),
            ReadingProgress_1.ReadingProgress.deleteMany({}),
            Bookmark_1.Bookmark.deleteMany({}),
            Review_1.Review.deleteMany({}),
        ]);
        console.log('[Seeder] Creating Users...');
        const salt = await bcryptjs_1.default.genSalt(10);
        const adminPassword = await bcryptjs_1.default.hash('Admin@12345', salt);
        const userPassword = await bcryptjs_1.default.hash('Reader@12345', salt);
        const adminUser = await User_1.User.create({
            name: 'BrightMind Admin',
            email: 'admin@muslimguardian.com',
            password: adminPassword,
            role: 'admin',
            avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
            status: 'active',
        });
        const readerUser = await User_1.User.create({
            name: 'Ibrahim Vance',
            email: 'reader@example.com',
            password: userPassword,
            role: 'user',
            avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
            status: 'active',
        });
        const fatimaUser = await User_1.User.create({
            name: 'Fatima Al-Mansoor',
            email: 'fatima@example.com',
            password: userPassword,
            role: 'user',
            avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80',
            status: 'active',
        });
        console.log('[Seeder] Creating Categories...');
        const categoriesData = [
            {
                name: 'Philosophy & Thought',
                slug: 'philosophy-thought',
                description: 'Deep contemplations on existence, moral clarity, ethics, and the timeless human journey.',
                icon: 'Compass',
                isFeatured: true,
                order: 1,
            },
            {
                name: 'Self Development',
                slug: 'self-development',
                description: 'Cultivating discipline, habits of excellence, resilience, and personal mastery.',
                icon: 'Sparkles',
                isFeatured: true,
                order: 2,
            },
            {
                name: 'History & Wisdom',
                slug: 'history-wisdom',
                description: 'Chronicles of classical golden ages, intellectual luminaries, and enduring civilization lessons.',
                icon: 'Landmark',
                isFeatured: true,
                order: 3,
            },
            {
                name: 'Business & Ethics',
                slug: 'business-ethics',
                description: 'Principled entrepreneurship, sacred wealth stewardship, and purpose-driven leadership.',
                icon: 'TrendingUp',
                isFeatured: true,
                order: 4,
            },
            {
                name: 'Science & Technology',
                slug: 'science-technology',
                description: 'Exploring technological frontiers, computational wisdom, natural wonders, and the future.',
                icon: 'Cpu',
                isFeatured: false,
                order: 5,
            },
            {
                name: 'Psychology & Mind',
                slug: 'psychology-mind',
                description: 'Understanding cognition, emotional equilibrium, mental models, and deep inner peace.',
                icon: 'Brain',
                isFeatured: false,
                order: 6,
            },
            {
                name: 'Literature & Fiction',
                slug: 'literature-fiction',
                description: 'Captivating narrative tapestries, allegories, and profound literary masterpieces.',
                icon: 'BookOpen',
                isFeatured: false,
                order: 7,
            },
        ];
        const categories = await Category_1.Category.insertMany(categoriesData);
        const catMap = new Map(categories.map((c) => [c.slug, c._id]));
        console.log('[Seeder] Creating Books, Chapters, and Pages...');
        // Book 1: The Architecture of Purpose
        const book1 = await Book_1.Book.create({
            title: 'The Architecture of Purpose',
            subtitle: 'Finding Clarity and Deep Meaning in an Age of Relentless Distraction',
            slug: 'the-architecture-of-purpose',
            author: 'Dr. Tariq Al-Mansoor',
            authorBio: 'Dr. Tariq Al-Mansoor is a philosopher and cognitive scientist whose writings on intentional living and human focus have been translated into twelve languages.',
            description: 'In a hyperconnected modern world fractured by superficial noise, living with conscious intention has become an endangered discipline. "The Architecture of Purpose" presents an intellectual framework combining classical wisdom with contemporary cognitive psychology to help you construct a life grounded in clarity, deliberate action, and enduring peace.',
            coverImage: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&auto=format&fit=crop&q=80',
            price: 24.99,
            originalPrice: 34.99,
            currency: 'USD',
            category: catMap.get('self-development'),
            language: 'English',
            isbn: '978-0-998877-11-2',
            publicationDate: new Date('2025-09-15'),
            pageCount: 12,
            previewPages: 4,
            previewPercentage: 25,
            status: 'published',
            isFeatured: true,
            isPopular: true,
            isNewRelease: true,
            rating: 4.9,
            reviewCount: 42,
            tags: ['Purpose', 'Focus', 'Habits', 'Mindfulness', 'Clarity'],
        });
        // Book 1 Chapters & Pages
        const b1Ch1 = await Chapter_1.Chapter.create({
            book: book1._id,
            title: 'Chapter 1: The Epidemic of Fragmented Attention',
            order: 1,
            description: 'Understanding how fractured focus diminishes human depth and deliberate will.',
        });
        const b1Ch2 = await Chapter_1.Chapter.create({
            book: book1._id,
            title: 'Chapter 2: Foundations of Intentional Living',
            order: 2,
            description: 'Designing first principles that govern decisions, routines, and spiritual equilibrium.',
        });
        const b1Ch3 = await Chapter_1.Chapter.create({
            book: book1._id,
            title: 'Chapter 3: The Sanctuary of Solitude',
            order: 3,
            description: 'Cultivating constructive silence and reflective spaces in high-density environments.',
        });
        const b1Ch4 = await Chapter_1.Chapter.create({
            book: book1._id,
            title: 'Chapter 4: Legacy and Enduring Impact',
            order: 4,
            description: 'Translating daily devotion into intergenerational wisdom and timeless value.',
        });
        // Pages for Book 1
        const book1PagesData = [
            // Chapter 1
            {
                book: book1._id,
                chapter: b1Ch1._id,
                pageNumber: 1,
                chapterPageNumber: 1,
                title: 'The Great Dissipation',
                content: `Every era suffers from its characteristic malady. For antiquity, it was physical vulnerability; for the industrial revolution, it was bodily exhaustion; for our contemporary age, it is the systematic fracture of human consciousness.

We awaken each morning into a torrential deluge of notifications, alerts, metrics, and demands on our cognitive reserves. The mind, evolved for natural rhythms of observation, contemplation, and deliberate labor, is instead bombarded by synthetic urgency.

To build an architecture of purpose, one must first recognize this fundamental truth: you cannot build a majestic palace upon tectonic quicksand. Until we reclaim sovereignty over our attention, all discussions of mission and ambition remain mere wishful thinking.`,
                wordCount: 112,
            },
            {
                book: book1._id,
                chapter: b1Ch1._id,
                pageNumber: 2,
                chapterPageNumber: 2,
                title: 'The Illusion of Hyper-Productivity',
                content: `Modern culture worships velocity over direction. We celebrate the person who replies to seventy emails in an hour, while ignoring whether those communications contributed a single grain of enduring value to the world.

Velocity without destination is merely kinetic panic. When we mistake motion for progress, we exhaust our emotional and spiritual faculties on tasks that leave no trace in the annals of meaningful contribution.

The true architect does not hurry to lay bricks; first, they spend weeks contemplating the soil, the weight of the lintels, and the path of the sun. Deep productivity is slow, deliberate, and fiercely guarded against superficial demands.`,
                wordCount: 104,
            },
            {
                book: book1._id,
                chapter: b1Ch1._id,
                pageNumber: 3,
                chapterPageNumber: 3,
                title: 'The Cost of Perpetual Availability',
                content: `When you declare yourself reachable by everyone at every moment, you surrender the possibility of ever reaching depth within yourself. Continuous partial attention leaves the mind in a state of low-grade anxiety, a biological posture of fight-or-flight triggered by simulated urgencies.

Classical scholars and philosophical masters understood this intimately. Whether in the ancient academies of Cordoba, the libraries of Baghdad, or the quiet retreats of Mount Sinai, every profound body of thought was born in the sacred crucible of unbroken silence.

Consider your past week: how many hours did you spend in uninterrupted contemplation of a single profound question? If the answer is zero, you are not living as the author of your life, but as an incidental character in everyone else's script.`,
                wordCount: 125,
            },
            // Chapter 2
            {
                book: book1._id,
                chapter: b1Ch2._id,
                pageNumber: 4,
                chapterPageNumber: 1,
                title: 'Defining First Principles',
                content: `An architectural foundation consists of immutable stones that do not shift with the weather. Similarly, a purpose-driven life is founded on non-negotiable principles rather than fluctuating moods.

What are the three core convictions upon which your decisions rest? If you cannot articulate them in simple language within ten seconds, your decisions are likely governed by immediate comfort or social validation.

When Marcus Aurelius or Al-Ghazali wrote their intimate journals, they returned daily to the same bedrock questions: What is my duty? How do I remain just when treated unfairly? What is worthy of a rational soul?`,
                wordCount: 98,
            },
            // Page 5 (Beyond Free Preview limit of 4)
            {
                book: book1._id,
                chapter: b1Ch2._id,
                pageNumber: 5,
                chapterPageNumber: 2,
                title: 'The Discipline of Sacred Routine',
                content: `Inspiration is an amateur's conceit. The master relies upon ritual, rhythm, and devotion. When you look at the greatest creators, philosophers, and spiritual exemplars throughout history, their days were marked by rigorous structural beauty.

The dawn hour is unblemished. Before the world awakens to broadcast its demands, the soul has already communed with its Creator, exercised its physical vessel, and immersed itself in the hardest cognitive endeavor of the day.

By standardizing the mundane decisions—what to wear, when to eat, how to start the morning—you preserve cognitive bandwidth for the monumental choices that determine your destiny.`,
                wordCount: 101,
            },
            {
                book: book1._id,
                chapter: b1Ch2._id,
                pageNumber: 6,
                chapterPageNumber: 3,
                title: 'Protecting the Inner Sanctum',
                content: `The mind is a fortress. If you leave the gates wide open, marauders and merchants alike will wander in to set up camp in your courtyards. You must install vigilant sentries at the threshold of your consciousness.

Filter ruthlessly what enters your mind. The podcasts you listen to, the conversations you indulge in, the visual feeds you consume—each leaves an indelible pigment on the canvas of your thoughts.

Seek beauty, truth, and rigorous thought. Feed your mind the finest vintage of human literature and spiritual wisdom, and watch as your inner dialogue elevates from petty grievances to noble aspirations.`,
                wordCount: 99,
            },
            // Chapter 3
            {
                book: book1._id,
                chapter: b1Ch3._id,
                pageNumber: 7,
                chapterPageNumber: 1,
                title: 'The Lost Art of Stillness',
                content: `In an orchestra, the music is not only in the sounding notes; it is equally created by the rests. Without silence between chords, sound degenerates into intolerable noise.

Solitude is the rest note in the symphony of your existence. In solitude, you encounter yourself without the comforting masks of status, occupation, and social charm. It is terrifying for the shallow, but invigorating for the genuine seeker.

Do not flee from silence. Sit with your thoughts. Allow the sediment stirred up by daily commotion to settle to the bottom of the glass until the water becomes clear once again.`,
                wordCount: 98,
            },
            {
                book: book1._id,
                chapter: b1Ch3._id,
                pageNumber: 8,
                chapterPageNumber: 2,
                title: 'The Sanctuary in Practice',
                content: `Create a physical and temporal sanctuary in your life. It can be a corner of a room with a single wooden chair, a notebook, and a lamp. When you cross into this space, digital devices are banished.

Here, you write by hand. You read long passages of timeless literature. You examine your conduct over the preceding day with gentleness and honesty.

Those who practice this daily ritual possess an unshakeable poise. When storms rage in the marketplace or within political spheres, they remain centered, anchored to an inner compass that cannot be moved by external turbulence.`,
                wordCount: 98,
            },
            {
                book: book1._id,
                chapter: b1Ch3._id,
                pageNumber: 9,
                chapterPageNumber: 3,
                title: 'Contemplation as Action',
                content: `A common Western misconception treats contemplation as passive laziness. In truth, genuine contemplation is the most rigorous form of human activity. It requires confronting biases, dismantling cognitive illusions, and synthesizing complex truths into actionable clarity.

When the scholar Ibn Rushd (Averroes) walked through the gardens of Seville, his quiet contemplation laid the philosophical bedrock that reawakened European rational inquiry centuries later.

Never apologize for thinking deeply. The world has enough reactive actors; what it desperately lacks are contemplative visionaries.`,
                wordCount: 84,
            },
            // Chapter 4
            {
                book: book1._id,
                chapter: b1Ch4._id,
                pageNumber: 10,
                chapterPageNumber: 1,
                title: 'Planting Trees Whose Shade You Will Never See',
                content: `True maturity arrives on the day a person plants an olive tree knowing full well they may not live to harvest its fruit. We are merely links in an unbroken chain stretching across millennia.

When we view our daily actions through the lens of centenary impact, petty jealousies and short-term anxieties wither away. You no longer fret over whether you receive applause today, because you are building for a horizon far beyond tomorrow.`,
                wordCount: 76,
            },
            {
                book: book1._id,
                chapter: b1Ch4._id,
                pageNumber: 11,
                chapterPageNumber: 2,
                title: 'The Harmony of Word and Deed',
                content: `The ultimate test of an architecture of purpose is integrity: does the facade match the inner structural integrity? Eloquent speeches and beautifully phrased manifestos mean nothing if daily conduct is characterized by deceit, pettiness, or cruelty.

Let your character speak so loudly that people barely need to hear your arguments. Live with such luminous sincerity that even your adversaries are forced to respect the nobility of your conduct.`,
                wordCount: 73,
            },
            {
                book: book1._id,
                chapter: b1Ch4._id,
                pageNumber: 12,
                chapterPageNumber: 3,
                title: 'The Open Horizon',
                content: `You now hold the blueprints. The tools of attention, discipline, solitude, and legacy are within your grasp. But an architectural blueprint builds nothing on its own; it requires the master craftsman to lift the hammer and lay the first stone.

Begin today. In this very hour. Turn off the frivolous screens, breathe deeply, and take the first deliberate step toward constructing a life worthy of your noble soul.`,
                wordCount: 71,
            },
        ];
        await Page_1.Page.insertMany(book1PagesData);
        await Book_1.Book.findByIdAndUpdate(book1._id, { pageCount: 12 });
        // Book 2: The Alchemist of Cordoba
        const book2 = await Book_1.Book.create({
            title: 'The Alchemist of Cordoba',
            subtitle: 'Science, Faith, and the Golden Age of Andalusian Illumination',
            slug: 'the-alchemist-of-cordoba',
            author: 'Prof. Maryam Qasim',
            authorBio: 'Prof. Maryam Qasim is Chair of Medieval Mediterranean History at Oxford, specializing in cross-cultural knowledge transmission and medieval scientific manuscripts.',
            description: 'A magnificent historical and philosophical narrative tracing how Muslim, Jewish, and Christian scholars in 10th-century Cordoba forged an intellectual sanctuary that preserved the ancient sciences and catalyzed the European Renaissance. An evocative tribute to reason, tolerance, and human ingenuity.',
            coverImage: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=800&auto=format&fit=crop&q=80',
            price: 29.99,
            originalPrice: 39.99,
            currency: 'USD',
            category: catMap.get('history-wisdom'),
            language: 'English',
            isbn: '978-0-998877-22-9',
            publicationDate: new Date('2025-06-10'),
            pageCount: 8,
            previewPages: 3,
            previewPercentage: 20,
            status: 'published',
            isFeatured: true,
            isPopular: true,
            isNewRelease: false,
            rating: 4.8,
            reviewCount: 38,
            tags: ['History', 'Andalus', 'Philosophy', 'Science', 'Wisdom'],
        });
        const b2Ch1 = await Chapter_1.Chapter.create({
            book: book2._id,
            title: 'Chapter 1: The City of Seven Hundred Baths',
            order: 1,
            description: 'Cordoba under the Umayyads: the brightest jewel of medieval Europe.',
        });
        const b2Ch2 = await Chapter_1.Chapter.create({
            book: book2._id,
            title: 'Chapter 2: The Translation Guilds of Toledo',
            order: 2,
            description: 'Bridging Greek, Arabic, Latin, and Hebrew intellectual lineages.',
        });
        await Page_1.Page.insertMany([
            {
                book: book2._id,
                chapter: b2Ch1._id,
                pageNumber: 1,
                chapterPageNumber: 1,
                title: 'The Lantern of Europe',
                content: `While much of Western Europe lay shrouded in the post-Roman dark age, where paved streets were forgotten and royal libraries rarely exceeded a dozen volumes, the city of Cordoba glowed like an incandescent sapphire on the banks of the Guadalquivir River.

Paved avenues spanned miles with public streetlamps that illuminated nocturnal strolls. Running water supplied more than seven hundred public baths, fifty hospitals, and an astonishing seventy libraries, the largest of which housed over four hundred thousand bound manuscripts.`,
                wordCount: 84,
            },
            {
                book: book2._id,
                chapter: b2Ch1._id,
                pageNumber: 2,
                chapterPageNumber: 2,
                title: 'The Great Mosque and Court of Scholars',
                content: `Inside the forest of red-and-white double arches of the Mezquita, scholars gathered from Baghdad, Cairo, Damascus, and Fez. Here, astronomy was not viewed as an adversary to piety, but as its sublime handmaiden.

Astrolabes of brass and silver calculated celestial coordinates with sub-millimeter precision, guiding both caravans across the Sahara and calculating prayer times toward Mecca.`,
                wordCount: 62,
            },
            {
                book: book2._id,
                chapter: b2Ch1._id,
                pageNumber: 3,
                chapterPageNumber: 3,
                title: 'The Harmony of Reason and Revelation',
                content: `In the salons of Madinat al-Zahra, Muslim philosophers debated Jewish thinkers like Hasdai ibn Shaprut and Christian bishops. They shared a common conviction: Truth is one, and genuine knowledge cannot contradict divine wisdom.

This ecumenical spirit created an ecosystem where mathematics, medicine, optics, botany, and jurisprudence flourished in unprecedented symbiosis.`,
                wordCount: 54,
            },
            {
                book: book2._id,
                chapter: b2Ch2._id,
                pageNumber: 4,
                chapterPageNumber: 1,
                title: 'Toledo: The Bridge Between Worlds',
                content: `As political fortunes shifted, the repository of knowledge moved northward to Toledo. Gerard of Cremona and Michael Scot arrived with ravenous intellectual curiosity, discovering Arabic translations and commentaries on Aristotle, Galen, Euclid, and Ptolemy.`,
                wordCount: 37,
            },
            {
                book: book2._id,
                chapter: b2Ch2._id,
                pageNumber: 5,
                chapterPageNumber: 2,
                title: 'The Spark of the Renaissance',
                content: `The manuscripts carried across the Pyrenees from Andalusia provided the essential spark that ignited the University of Paris, Oxford, and Bologna. Without the Andalusian crucible, the European Enlightenment would have lacked its foundational texts.`,
                wordCount: 37,
            },
            {
                book: book2._id,
                chapter: b2Ch2._id,
                pageNumber: 6,
                chapterPageNumber: 3,
                title: 'Echoes Across the Millennia',
                content: `Today, when we gaze upon the delicate calligraphy etched into the stucco walls of the Alhambra or inspect an algebraic treatise, we are reminded that human civilization is a relay race across centuries, where the torch is passed with honor between diverse peoples.`,
                wordCount: 45,
            },
            {
                book: book2._id,
                chapter: b2Ch2._id,
                pageNumber: 7,
                chapterPageNumber: 4,
                title: 'The Duty of Memory',
                content: `History is not merely a record of battles won and kingdoms lost; it is a repository of human potential. Remembering Cordoba is a vital reminder that reason, beauty, and shared intellectual reverence are possible even in turbulent times.`,
                wordCount: 40,
            },
            {
                book: book2._id,
                chapter: b2Ch2._id,
                pageNumber: 8,
                chapterPageNumber: 5,
                title: 'The Eternal Flame',
                content: `As the sunset paints the arches of Cordoba in amber and gold, the spirit of inquiry remains unextinguished. It lives on in every student who opens a book with wonder and every thinker who refuses to surrender truth to dogma.`,
                wordCount: 42,
            },
        ]);
        await Book_1.Book.findByIdAndUpdate(book2._id, { pageCount: 8 });
        // Book 3: The Disciplined Mind
        const book3 = await Book_1.Book.create({
            title: 'The Disciplined Mind',
            subtitle: 'Habits, Focus, and the Science of Timeless High Performance',
            slug: 'the-disciplined-mind',
            author: 'Arthur Sterling',
            authorBio: 'Arthur Sterling is an executive advisor, former cognitive researcher, and author of three international bestsellers.',
            description: 'How do the worlds most enduring thinkers, creators, and leaders sustain supreme focus without burning out? "The Disciplined Mind" decodes neurobiology, psychological momentum, and daily micro-habits to give you a pragmatic blueprint for mastery.',
            coverImage: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&auto=format&fit=crop&q=80',
            price: 19.99,
            originalPrice: 27.99,
            currency: 'USD',
            category: catMap.get('self-development'),
            language: 'English',
            isbn: '978-0-998877-33-6',
            publicationDate: new Date('2025-11-01'),
            pageCount: 6,
            previewPages: 2,
            previewPercentage: 30,
            status: 'published',
            isFeatured: true,
            isPopular: true,
            isNewRelease: true,
            rating: 4.95,
            reviewCount: 56,
            tags: ['Discipline', 'Mindset', 'Productivity', 'Habits'],
        });
        const b3Ch1 = await Chapter_1.Chapter.create({
            book: book3._id,
            title: 'Chapter 1: The Anatomy of Willpower',
            order: 1,
            description: 'Why relying on motivation guarantees failure, and how to build friction-free execution.',
        });
        await Page_1.Page.insertMany([
            {
                book: book3._id,
                chapter: b3Ch1._id,
                pageNumber: 1,
                chapterPageNumber: 1,
                title: 'The Myth of Inspiration',
                content: `Motivation is a fickle visitor; discipline is the loyal householder. If you wait until you feel energized to write, to train, to research, or to solve a complex dilemma, you will perform only forty days a year.

The elite cultivate automaticity. They design environmental triggers that remove the friction of decision-making, allowing their willpower to be preserved for creative and analytical execution.`,
                wordCount: 68,
            },
            {
                book: book3._id,
                chapter: b3Ch1._id,
                pageNumber: 2,
                chapterPageNumber: 2,
                title: 'The 90-Minute Focus Protocol',
                content: `Human neurophysiology operates on ultradian rhythms. Research reveals that deep cognitive work reaches its zenith within a focused 90-minute cycle, followed by a mandatory period of recovery.

Attempting to grind uninterrupted for eight hours produces diminishing returns and mental fog. Learn to work with rhythmic intensity, oscillating between uncompromising focus and rejuvenating rest.`,
                wordCount: 58,
            },
            {
                book: book3._id,
                chapter: b3Ch1._id,
                pageNumber: 3,
                chapterPageNumber: 3,
                title: 'Designing Your Cognitive Environment',
                content: `Your environment is the invisible hand shaping your behavior. If a smartphone sits on your desk, even facedown, your subconscious brain expends measurable glucose simply suppressing the urge to inspect it. Remove temptation entirely to unleash effortless focus.`,
                wordCount: 40,
            },
            {
                book: book3._id,
                chapter: b3Ch1._id,
                pageNumber: 4,
                chapterPageNumber: 4,
                title: 'Micro-Habits and Compound Returns',
                content: `A 1% improvement repeated daily for 365 days yields a thirty-seven-fold transformation. Do not despise the day of small beginnings. Ten pages read today is an entire library read across a lifetime.`,
                wordCount: 35,
            },
            {
                book: book3._id,
                chapter: b3Ch1._id,
                pageNumber: 5,
                chapterPageNumber: 5,
                title: 'The Emotional Armor of Resilience',
                content: `When adversity strikes—a failed venture, a missed deadline, an unexpected setback—the disciplined mind does not indulge in theatrical despair. It asks with surgical clarity: What is within my control right now? And it gets to work.`,
                wordCount: 40,
            },
            {
                book: book3._id,
                chapter: b3Ch1._id,
                pageNumber: 6,
                chapterPageNumber: 6,
                title: 'The Masterpiece of a Well-Lived Life',
                content: `In the final analysis, discipline is not self-deprivation; it is self-respect. It is the refusal to sacrifice who you could become on the altar of immediate convenience. Live deliberately, with poise, power, and unflinching resolve.`,
                wordCount: 38,
            },
        ]);
        await Book_1.Book.findByIdAndUpdate(book3._id, { pageCount: 6 });
        // Additional Books 4, 5, 6, 7, 8
        const book4 = await Book_1.Book.create({
            title: 'Principles of Sacred Commerce',
            subtitle: 'Building Ethical Wealth and Lasting Legacy in Modern Markets',
            slug: 'principles-of-sacred-commerce',
            author: 'Ibrahim Bello & Dr. Zainab Farooq',
            authorBio: 'Ibrahim Bello is a seasoned venture investor and ethical finance specialist who advises global sovereign funds.',
            description: 'Finance divorced from moral responsibility produces hollow wealth and societal instability. This landmark book synthesizes ancient mercantile wisdom with modern venture economics to showcase how entrepreneurs can build high-growth, highly profitable enterprises without compromising ethical integrity.',
            coverImage: 'https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=800&auto=format&fit=crop&q=80',
            price: 27.5,
            originalPrice: 35.0,
            currency: 'USD',
            category: catMap.get('business-ethics'),
            language: 'English',
            isbn: '978-0-998877-44-3',
            publicationDate: new Date('2025-08-20'),
            pageCount: 5,
            previewPages: 2,
            previewPercentage: 20,
            status: 'published',
            isFeatured: false,
            isPopular: true,
            isNewRelease: false,
            rating: 4.88,
            reviewCount: 29,
            tags: ['Wealth', 'Ethics', 'Finance', 'Leadership', 'Business'],
        });
        const b4Ch1 = await Chapter_1.Chapter.create({
            book: book4._id,
            title: 'Chapter 1: The Stewardship of Capital',
            order: 1,
            description: 'Reconceptualizing money as a trust rather than mere personal trophy.',
        });
        await Page_1.Page.insertMany([
            {
                book: book4._id,
                chapter: b4Ch1._id,
                pageNumber: 1,
                chapterPageNumber: 1,
                title: 'The Merchant Scholar Tradition',
                content: `Throughout Mediterranean and Silk Road history, commerce was considered a noble civic and spiritual vocation. The ethical merchant was celebrated as a pillar of community resilience, distributing goods, catalyzing employment, and funding universities and hospitals.`,
                wordCount: 38,
            },
            {
                book: book4._id,
                chapter: b4Ch1._id,
                pageNumber: 2,
                chapterPageNumber: 2,
                title: 'Risk Sharing over Exploitative Extraction',
                content: `When finance is built on mutual risk-sharing (equity partnerships) rather than predatory interest extraction, economic systems become robust against speculative bubbles. Capital flows toward genuine value creation rather than parasitic speculation.`,
                wordCount: 36,
            },
            {
                book: book4._id,
                chapter: b4Ch1._id,
                pageNumber: 3,
                chapterPageNumber: 3,
                title: 'The Quadruple Bottom Line',
                content: `Sacred commerce evaluates success across four dimensions: financial profitability, environmental stewardship, employee dignity, and societal uplift. A business that harms its community to maximize short-term quarterly EBITDA is not wealthy—it is morally bankrupt.`,
                wordCount: 39,
            },
            {
                book: book4._id,
                chapter: b4Ch1._id,
                pageNumber: 4,
                chapterPageNumber: 4,
                title: 'Transparent Pricing and Honest Contracts',
                content: `Deception in pricing or contract ambiguity destroys the fundamental currency of commerce: trust. The world's most resilient enterprises across centuries were built on unassailable reputational integrity.`,
                wordCount: 29,
            },
            {
                book: book4._id,
                chapter: b4Ch1._id,
                pageNumber: 5,
                chapterPageNumber: 5,
                title: 'Generosity as a Growth Engine',
                content: `Far from diminishing wealth, systematic philanthropy and endowment building (Waqf) create social goodwill, loyal customer advocacy, and generational blessings that outlive market cycles.`,
                wordCount: 26,
            },
        ]);
        await Book_1.Book.findByIdAndUpdate(book4._id, { pageCount: 5 });
        const book5 = await Book_1.Book.create({
            title: 'Algorithmic Civilization',
            subtitle: 'Philosophy, Human Autonomy, and the Frontiers of Future Technology',
            slug: 'algorithmic-civilization',
            author: 'Kenji Vance & Prof. Amina Idris',
            authorBio: 'Kenji Vance is a systems philosopher and former AI ethics advisor to multinational research consortia.',
            description: 'As automated systems, neural networks, and algorithmic governance expand into every domain of human existence, what becomes of human agency, contemplative thought, and moral responsibility? A groundbreaking philosophical inquiry into the digital age.',
            coverImage: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80',
            price: 22.0,
            currency: 'USD',
            category: catMap.get('science-technology'),
            language: 'English',
            isbn: '978-0-998877-55-0',
            publicationDate: new Date('2025-10-12'),
            pageCount: 5,
            previewPages: 2,
            previewPercentage: 20,
            status: 'published',
            isFeatured: false,
            isPopular: false,
            isNewRelease: true,
            rating: 4.75,
            reviewCount: 18,
            tags: ['Technology', 'Philosophy', 'Future', 'Ethics'],
        });
        const b5Ch1 = await Chapter_1.Chapter.create({
            book: book5._id,
            title: 'Chapter 1: The Digital Leviathan',
            order: 1,
            description: 'Understanding the silent architectural transformation of human decision-making.',
        });
        await Page_1.Page.insertMany([
            {
                book: book5._id,
                chapter: b5Ch1._id,
                pageNumber: 1,
                chapterPageNumber: 1,
                title: 'The Great Automation of Choice',
                content: `From the playlists we hear to the news we read and the routes we drive, invisible optimization algorithms guide our decisions. Convenience is the Trojan horse through which human cognitive autonomy is systematically outsourced.`,
                wordCount: 36,
            },
            {
                book: book5._id,
                chapter: b5Ch1._id,
                pageNumber: 2,
                chapterPageNumber: 2,
                title: 'The Sanctity of Human Consciousness',
                content: `Silicon and neural matrices can process petaflops of pattern recognition, but they possess no interiority, no empathy, and no spiritual consciousness. Preserving the human essence requires defending spaces that cannot be quantified by metrics.`,
                wordCount: 36,
            },
            {
                book: book5._id,
                chapter: b5Ch1._id,
                pageNumber: 3,
                chapterPageNumber: 3,
                title: 'Engineering for Human Flourishing',
                content: `Technology must remain a faithful servant to human values, never an autonomous master. Systems architects carry the moral duty to design tools that elevate human wisdom rather than engineer addiction.`,
                wordCount: 31,
            },
            {
                book: book5._id,
                chapter: b5Ch1._id,
                pageNumber: 4,
                chapterPageNumber: 4,
                title: 'The Renaissance of the Analog',
                content: `As synthetic generation proliferates, physical books, handwritten calligraphy, face-to-face dialogue, and acoustic presence will command the highest cultural premium in human society.`,
                wordCount: 25,
            },
            {
                book: book5._id,
                chapter: b5Ch1._id,
                pageNumber: 5,
                chapterPageNumber: 5,
                title: 'The Human Covenant',
                content: `We are not biological computers awaiting replacement. We are conscious beings endowed with moral will, love, and sacred curiosity. The future belongs to those who harmonize cutting-edge tools with timeless human virtues.`,
                wordCount: 33,
            },
        ]);
        await Book_1.Book.findByIdAndUpdate(book5._id, { pageCount: 5 });
        // Additional Books 6, 7, 8
        const book6 = await Book_1.Book.create({
            title: 'The Garden of Certainty',
            subtitle: 'Contemplations on Faith, Equanimity, and the Inner Heart',
            slug: 'the-garden-of-certainty',
            author: 'Sheikh Zayd Bilal',
            authorBio: 'Sheikh Zayd Bilal is a classical scholar and teacher of spiritual psychology, ethics, and contemplative texts.',
            description: 'A soothing, intellectually profound journey into the spiritual heart. Explores how to navigate existential grief, cultivate inner tranquility (Itmi’nan), and anchor the soul to immutable divine truth amidst the turbulence of modern life.',
            coverImage: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80',
            price: 21.0,
            currency: 'USD',
            category: catMap.get('philosophy-thought'),
            language: 'English',
            isbn: '978-0-998877-66-7',
            publicationDate: new Date('2025-07-04'),
            pageCount: 5,
            previewPages: 2,
            previewPercentage: 20,
            status: 'published',
            isFeatured: true,
            isPopular: false,
            isNewRelease: false,
            rating: 4.96,
            reviewCount: 51,
            tags: ['Peace', 'Spirituality', 'Heart', 'Faith', 'Meditation'],
        });
        const b6Ch1 = await Chapter_1.Chapter.create({
            book: book6._id,
            title: 'Chapter 1: The Mirror of the Soul',
            order: 1,
            description: 'Purifying the inner vessel from resentment, arrogance, and anxiety.',
        });
        await Page_1.Page.insertMany([
            {
                book: book6._id,
                chapter: b6Ch1._id,
                pageNumber: 1,
                chapterPageNumber: 1,
                title: 'The Thirst for Peace',
                content: `Every human being searches endlessly for peace. Some seek it in wealth, others in fame, and still others in sensory indulgence. Yet all discover that external acquisitions cannot satisfy an internal spiritual yearning. Peace is found only when the heart aligns with its Origin.`,
                wordCount: 46,
            },
            {
                book: book6._id,
                chapter: b6Ch1._id,
                pageNumber: 2,
                chapterPageNumber: 2,
                title: 'The Light of Gratitude',
                content: `Gratitude is not mere polite etiquette; it is a lens that transforms reality. When you acknowledge the countless blessings of breath, sight, intellect, and love, bitterness evaporates and the garden of certainty blooms within.`,
                wordCount: 36,
            },
            {
                book: book6._id,
                chapter: b6Ch1._id,
                pageNumber: 3,
                chapterPageNumber: 3,
                title: 'Navigating the Trials of Life',
                content: `Trials are not punitive rejections; they are divine polishing stones meant to remove the rough edges of self-delusion. In patience (Sabr) lies the secret of spiritual fortitude.`,
                wordCount: 27,
            },
            {
                book: book6._id,
                chapter: b6Ch1._id,
                pageNumber: 4,
                chapterPageNumber: 4,
                title: 'The Silent Prayer of the Heart',
                content: `Beyond vocal petitions lies the quiet surrender of the soul, trusting the wisdom of the Creator even when the immediate horizon appears clouded.`,
                wordCount: 24,
            },
            {
                book: book6._id,
                chapter: b6Ch1._id,
                pageNumber: 5,
                chapterPageNumber: 5,
                title: 'The Eternal Abode',
                content: `We are travelers walking through a brief caravanserai. May our footsteps be light, our speech gentle, and our legacy an enduring fragrant garden for those who follow.`,
                wordCount: 27,
            },
        ]);
        await Book_1.Book.findByIdAndUpdate(book6._id, { pageCount: 5 });
        // Seed Completed Orders for readerUser (owns Book 1 and Book 2)
        console.log('[Seeder] Creating Orders & Library records...');
        const order1 = await Order_1.Order.create({
            user: readerUser._id,
            items: [
                {
                    book: book1._id,
                    title: book1.title,
                    price: book1.price,
                    coverImage: book1.coverImage,
                },
                {
                    book: book2._id,
                    title: book2.title,
                    price: book2.price,
                    coverImage: book2.coverImage,
                },
            ],
            totalAmount: book1.price + book2.price,
            currency: 'USD',
            paymentStatus: 'completed',
            paymentMethod: 'paystack',
            transactionReference: `BRIGHT-SEED-${Date.now()}-101`,
            accessGranted: true,
            paidAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        });
        const order2 = await Order_1.Order.create({
            user: fatimaUser._id,
            items: [
                {
                    book: book3._id,
                    title: book3.title,
                    price: book3.price,
                    coverImage: book3.coverImage,
                },
            ],
            totalAmount: book3.price,
            currency: 'USD',
            paymentStatus: 'completed',
            paymentMethod: 'paystack',
            transactionReference: `BRIGHT-SEED-${Date.now()}-202`,
            accessGranted: true,
            paidAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        });
        // Seed Reading Progress
        console.log('[Seeder] Creating Reading Progress & Bookmarks...');
        await ReadingProgress_1.ReadingProgress.create({
            user: readerUser._id,
            book: book1._id,
            currentChapter: b1Ch2._id,
            currentPage: 5,
            totalPages: 12,
            percentage: 42,
            isFinished: false,
            lastReadAt: new Date(),
        });
        await ReadingProgress_1.ReadingProgress.create({
            user: readerUser._id,
            book: book2._id,
            currentChapter: b2Ch1._id,
            currentPage: 3,
            totalPages: 8,
            percentage: 38,
            isFinished: false,
            lastReadAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        });
        // Seed Bookmarks
        await Bookmark_1.Bookmark.create({
            user: readerUser._id,
            book: book1._id,
            chapter: b1Ch1._id,
            pageNumber: 3,
            note: 'Crucial quote on the cost of continuous partial attention.',
        });
        await Bookmark_1.Bookmark.create({
            user: readerUser._id,
            book: book1._id,
            chapter: b1Ch2._id,
            pageNumber: 5,
            note: 'The 3 morning questions to ask every sunrise.',
        });
        // Seed Customer Reviews
        console.log('[Seeder] Creating Customer Reviews...');
        await Review_1.Review.create({
            user: readerUser._id,
            book: book1._id,
            rating: 5,
            title: 'A transformative masterpiece for modern focus',
            comment: 'Dr. Al-Mansoor has written the definitive guide to deep living in a distracted age. The chapters on solitude and sacred routines completely shifted my morning habits.',
            isVerifiedPurchase: true,
            isModerated: true,
        });
        await Review_1.Review.create({
            user: fatimaUser._id,
            book: book1._id,
            rating: 5,
            title: 'Intellectually rigorous and spiritually nourishing',
            comment: 'The balance between modern cognitive neuroscience and classical philosophy makes this book stand far above typical self-help literature. The reader interface is also remarkably smooth.',
            isVerifiedPurchase: true,
            isModerated: true,
        });
        await Review_1.Review.create({
            user: readerUser._id,
            book: book2._id,
            rating: 5,
            title: 'Brings medieval Cordoba vividly to life',
            comment: 'Prof. Qasim captures the intellectual grandeur and tolerance of Muslim Spain with breathtaking historical detail. A must-read for any lover of history.',
            isVerifiedPurchase: true,
            isModerated: true,
        });
        console.log('[Seeder] Seed completed successfully!');
        console.log('=============================================');
        console.log('🌟 Admin Account: admin@muslimguardian.com / Admin@12345');
        console.log('🌟 Reader Account: reader@example.com / Reader@12345');
        console.log('🌟 Reader Account 2: fatima@example.com / Reader@12345');
        console.log('=============================================');
        process.exit(0);
    }
    catch (error) {
        console.error('[Seeder] Error during seeding:', error);
        process.exit(1);
    }
};
seedDatabase();
