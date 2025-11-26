'use client';

import { useState } from 'react';

interface SearchResult {
  _id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  score: number;
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [message, setMessage] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      const data = await response.json();

      if (data.success) {
        setResults(data.results);
        if (data.results.length === 0) {
          setMessage('No results found. Try a different query or seed the database first.');
        }
      } else {
        setMessage(`Error: ${data.error}`);
        setResults([]);
      }
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    setMessage('');

    try {
      const response = await fetch('/api/seed', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setMessage(`✓ ${data.message}`);
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            MongoDB Vector Search
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Semantic product search using MongoDB Community Edition 8.2
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-6 mb-6">
          <div className="flex gap-4 mb-6">
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {seeding ? 'Seeding...' : 'Seed Database'}
            </button>
          </div>

          {message && (
            <div className={`mb-4 p-3 rounded-lg ${
              message.startsWith('✓') 
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
            }`}>
              {message}
            </div>
          )}

          <form onSubmit={handleSearch} className="mb-6">
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for products (e.g., 'fitness gear', 'morning routine', 'work from home')"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </form>

          {results.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Results ({results.length})
              </h2>
              <div className="space-y-4">
                {results.map((result) => (
                  <div
                    key={result._id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {result.name}
                      </h3>
                      <div className="text-right">
                        <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                          Score: {result.score.toFixed(3)}
                        </span>
                      </div>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 mb-2">
                      {result.description}
                    </p>
                    <div className="flex justify-between items-center text-sm">
                      <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
                        {result.category}
                      </span>
                      <span className="text-lg font-bold text-gray-900 dark:text-white">
                        ${result.price.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
            Getting Started:
          </h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800 dark:text-blue-300">
            <li>Start MongoDB with: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">docker-compose up -d</code></li>
            <li>Create the vector search index (see README.md)</li>
            <li>Click "Seed Database" to populate sample products</li>
            <li>Try searching with semantic queries like "fitness gear" or "morning routine"</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
