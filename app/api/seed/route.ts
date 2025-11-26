import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';
import { generateEmbedding } from '@/lib/embeddings';

// Sample product data for the vector search demo
const sampleProducts = [
  {
    name: 'Wireless Bluetooth Headphones',
    description: 'Premium over-ear headphones with active noise cancellation, 30-hour battery life, and superior sound quality for music lovers.',
    category: 'Electronics',
    price: 199.99,
  },
  {
    name: 'Yoga Mat',
    description: 'Eco-friendly non-slip yoga mat with extra cushioning, perfect for all types of yoga, pilates, and floor exercises.',
    category: 'Sports & Fitness',
    price: 39.99,
  },
  {
    name: 'Organic Green Tea',
    description: 'Premium loose leaf green tea sourced from organic farms, rich in antioxidants and perfect for daily wellness.',
    category: 'Food & Beverages',
    price: 24.99,
  },
  {
    name: 'Laptop Stand',
    description: 'Adjustable aluminum laptop stand for ergonomic working, compatible with all laptop sizes, improves posture and reduces neck pain.',
    category: 'Office Supplies',
    price: 49.99,
  },
  {
    name: 'Running Shoes',
    description: 'Lightweight running shoes with responsive cushioning and breathable mesh upper, designed for long-distance runners.',
    category: 'Sports & Fitness',
    price: 129.99,
  },
  {
    name: 'Smart Watch',
    description: 'Fitness tracking smartwatch with heart rate monitor, GPS, sleep tracking, and notifications for calls and messages.',
    category: 'Electronics',
    price: 299.99,
  },
  {
    name: 'Coffee Maker',
    description: 'Programmable drip coffee maker with thermal carafe, brew strength control, and automatic shut-off for perfect coffee every morning.',
    category: 'Home & Kitchen',
    price: 89.99,
  },
  {
    name: 'Meditation Cushion',
    description: 'Comfortable meditation cushion filled with buckwheat hulls, provides proper posture support for meditation and mindfulness practice.',
    category: 'Sports & Fitness',
    price: 44.99,
  },
  {
    name: 'Wireless Keyboard and Mouse',
    description: 'Ergonomic wireless keyboard and mouse combo with long battery life, silent keys, and comfortable design for productivity.',
    category: 'Electronics',
    price: 69.99,
  },
  {
    name: 'Protein Powder',
    description: 'Whey protein isolate powder for muscle recovery and growth, available in vanilla flavor with 25g protein per serving.',
    category: 'Food & Beverages',
    price: 54.99,
  },
  {
    name: 'Reading Lamp',
    description: 'LED desk reading lamp with adjustable brightness and color temperature, eye-friendly design for late-night reading.',
    category: 'Home & Kitchen',
    price: 34.99,
  },
  {
    name: 'Water Bottle',
    description: 'Insulated stainless steel water bottle keeps drinks cold for 24 hours or hot for 12 hours, perfect for gym and outdoor activities.',
    category: 'Sports & Fitness',
    price: 29.99,
  },
];

export async function POST() {
  try {
    const collection = await getCollection('products');

    // Clear existing data
    await collection.deleteMany({});

    // Generate embeddings for each product
    const productsWithEmbeddings = await Promise.all(
      sampleProducts.map(async (product) => {
        const textToEmbed = `${product.name} ${product.description} ${product.category}`;
        const embedding = await generateEmbedding(textToEmbed);

        return {
          ...product,
          embedding,
          createdAt: new Date(),
        };
      })
    );

    // Insert products with embeddings
    const result = await collection.insertMany(productsWithEmbeddings);

    return NextResponse.json({
      success: true,
      message: `Successfully seeded ${result.insertedCount} products with embeddings`,
      count: result.insertedCount,
    });
  } catch (error) {
    console.error('Error seeding database:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
