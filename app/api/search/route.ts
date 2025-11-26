import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';
import { generateEmbedding } from '@/lib/embeddings';

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    // Generate embedding for the search query
    const queryEmbedding = await generateEmbedding(query);

    // Get the products collection
    const collection = await getCollection('products');

    // Use MongoDB's $vectorSearch aggregation stage
    const results = await collection
      .aggregate([
        {
          $vectorSearch: {
            index: 'vector_index',
            path: 'embedding',
            queryVector: queryEmbedding,
            numCandidates: 100,
            limit: 10,
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            description: 1,
            category: 1,
            price: 1,
            score: { $meta: 'vectorSearchScore' },
          },
        },
      ])
      .toArray();

    return NextResponse.json({
      success: true,
      query,
      results,
      count: results.length,
    });
  } catch (error) {
    console.error('Error performing vector search:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
