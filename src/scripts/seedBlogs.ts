import mongoose from 'mongoose';
import { config } from '../config/env';
import { Blog } from '../models/Blog';

const sampleBlogs = [
  {
    title: 'The Lost Art of Contemplative Reading (Fikr) in a Fragmented World',
    slug: 'the-lost-art-of-contemplative-reading-fikr',
    excerpt:
      'In an age of relentless dopamine loops and endless feeds, deliberate deep reading is not merely a cognitive skill—it is an act of spiritual defiance.',
    content: `### The Acceleration of Distraction

Modern consciousness is perpetually divided. We skim dozens of headlines, jump across tabs, and absorb bite-sized snippets without ever arriving at stillness. Yet across Islamic intellectual history, the acquisition of knowledge (*ilm*) was never separated from deep, deliberate contemplation (*fikr*).

> "Reflecting for an hour with presence of heart is superior to a night spent in heedless motion." — Classical Maxim

When classical scholars opened a codex, they did not read merely to consume information; they read to allow truth to reshape their character (*akhlaq*). Reading was understood as an intimate communion between the seeking mind and eternal wisdom.

### Rebuilding the Digital Sanctuary

To recover this capacity, readers must cultivate intentional boundaries:

1. **Discrete Sessions**: Read for uninterrupted 30-minute intervals without notifications.
2. **Active Marginalia & Reflection**: Record insights and questions directly rather than passively scanning.
3. **Pacing**: Read with reverence, pausing at passages that evoke wonder (*haybah*) or introspection (*muhasabah*).

At *Living in the light of Allah*, our interactive reader is engineered precisely around these principles: minimal chrome, paper and sepia tones, and focused chapter progression designed for quiet contemplation.`,
    coverImage: '/images/hero-bg.jpg',
    author: 'Shaykh Tariq Al-Mansoor',
    category: 'Spiritual Reflections',
    tags: ['Contemplation', 'Mindfulness', 'Sacred Knowledge', 'Reading'],
    isPublished: true,
    readTimeMinutes: 5,
    views: 142,
  },
  {
    title: 'Preserving Sacred Manuscripts: How Classical Thinkers Guarded Intellectual Heritage',
    slug: 'preserving-sacred-manuscripts-intellectual-heritage',
    excerpt:
      'From the grand libraries of Baghdad and Cordoba to desert vaults in Timbuktu, explore the meticulous devotion that preserved sacred works across centuries.',
    content: `### The Golden Chains of Custodianship

The survival of classical philosophy, theological treatises, and ethical wisdom was never an accident of history. It was the fruit of an extraordinary civilization-wide dedication to textual preservation (*isnad* and *tahqiq*).

Scribes spent lifetimes perfecting inks, binding leather, and verifying every diacritical mark against authoritative recitations. Scribes and scholars understood that preserving a manuscript was equivalent to safeguarding an ember of divine guidance.

### The Responsibility of Modern Digital Publishing

Today, the challenge is not scarcity, but preservation of sanctity and quality amid digital noise:

- **Rigorous Verification**: Digital texts must respect the authoritative lineage of classical editions.
- **Distraction-Free Formatting**: Elegant typography honors the text and elevates the reading experience.
- **Permanent Stewardship**: Ensuring readers own and treasure their digital library permanently rather than renting ephemeral feeds.

We honor this timeless tradition by curating editions that uphold intellectual and spiritual fidelity.`,
    coverImage: '/images/insight-1.jpg',
    author: 'Dr. Hamza Yusufi',
    category: 'Classical Heritage',
    tags: ['History', 'Manuscripts', 'Scholarship', 'Philosophy'],
    isPublished: true,
    readTimeMinutes: 6,
    views: 98,
  },
  {
    title: 'Spiritual Equilibrium: Harmonizing Ethical Commerce and Inner Serenity',
    slug: 'spiritual-equilibrium-ethical-commerce-inner-serenity',
    excerpt:
      'A practical philosophical inquiry into maintaining ethical integrity, purpose-driven entrepreneurship, and a peaceful heart in modern commerce.',
    content: `### Beyond Mere Transaction

In classical Islamic jurisprudence, the marketplace (*al-suq*) was never viewed as a secular vacuum devoid of moral consequence. Rather, the market was considered a vital arena for spiritual testing and ethical excellence (*ihsan*).

The honest merchant was promised companionship with prophets and righteous seekers, because business conducted with honesty requires constant triumph over greed and deceit.

### The Three Pillars of Purposeful Enterprise

1. **Transparency & Sincerity**: Refusing misleading assurances or manufactured scarcity.
2. **Value over Exploitation**: Ensuring every transaction enriches both parties genuinely.
3. **Interior Detachment**: Holding wealth in the hand rather than letting it conquer the heart (*zuhd*).

True serenity is not achieved by withdrawing entirely from worldly affairs, but by engaging with the world while remaining firmly anchored in God.`,
    coverImage: '/images/insight-2.jpg',
    author: 'Ustadha Fatima Zahra',
    category: 'Ethical Living',
    tags: ['Ethics', 'Commerce', 'Spiritual Mastery', 'Balance'],
    isPublished: true,
    readTimeMinutes: 4,
    views: 115,
  },
  {
    title: 'The Architecture of Purpose: Finding Clarity in a Season of Uncertainty',
    slug: 'the-architecture-of-purpose-finding-clarity',
    excerpt:
      'When external circumstances seem chaotic, classical wisdom reminds us that clarity begins from an ordered interior state.',
    content: `### The Foundation of Internal Order

Human beings yearn for certainty. When governments falter, economies fluctuate, and cultural norms shift, anxiety naturally rises. Yet the sages of history consistently reminded their students:

> "You cannot calm the storm of the world until you calm the storm within your own chest."

Purpose (*niyyah*) acts as an anchor. It transforms ordinary routines into sacred duties and shields the soul against helplessness.

### Steps Toward Interior Steadfastness

- **Establish Regular Spiritual Anchors**: Consistent morning and evening devotions create an unshakable rhythm.
- **Audit Information Diet**: Restrict exposure to sensationalized discourse that fuels helplessness without offering constructive action.
- **Engage with Enduring Literature**: Read books that have stood the test of centuries rather than reactive social commentary.

Clarity is not found in having all the answers; it is found in knowing where your ultimate allegiance lies.`,
    coverImage: '/images/hero-taj-mahal.jpg',
    author: 'Shaykh Tariq Al-Mansoor',
    category: 'Self Development',
    tags: ['Purpose', 'Clarity', 'Inner Peace', 'Wisdom'],
    isPublished: true,
    readTimeMinutes: 5,
    views: 204,
  },
];

async function seedBlogs() {
  try {
    console.log('[Seed] Connecting to MongoDB...');
    await mongoose.connect(config.mongoUri);
    console.log('[Seed] Connected successfully.');

    for (const blogData of sampleBlogs) {
      await Blog.findOneAndUpdate(
        { slug: blogData.slug },
        blogData,
        { upsert: true, new: true }
      );
      console.log(`[Seed] Seeded blog: "${blogData.title}"`);
    }

    console.log('[Seed] All sample blogs seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error('[Seed] Error seeding blogs:', err);
    process.exit(1);
  }
}

seedBlogs();
