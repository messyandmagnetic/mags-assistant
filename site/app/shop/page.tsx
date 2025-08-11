'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

interface Product {
  id: string;
  name: string;
  price: number;
  image?: string;
}

const placeholder = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Crect width='300' height='300' fill='%23E8C8C3'/%3E%3C/svg%3E";

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/products')
      .then((res) => res.json())
      .then((data) => setProducts(data.products || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section className="py-12 text-center">
        <p>Loading...</p>
      </section>
    );
  }

  return (
    <section className="py-12">
      <h1 className="mb-6 text-center font-heading text-3xl">Shop</h1>
      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
        {products.map((p) => (
          <div
            key={p.id}
            className="rounded-lg bg-white/80 p-4 text-center shadow-sm"
          >
            <Image
              src={p.image || placeholder}
              alt={p.name}
              width={300}
              height={300}
              className="h-48 w-full rounded object-cover"
            />
            <h3 className="mt-4 font-heading">{p.name}</h3>
            <p className="text-brand-ink/80">${p.price.toFixed(2)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
