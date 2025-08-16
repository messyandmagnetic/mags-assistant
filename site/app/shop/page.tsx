import Image from 'next/image';
import Link from 'next/link';

interface Product {
  id: string;
  name: string;
  price: number;
  checkoutUrl?: string;
  image?: string | null;
}

const placeholder = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Crect width='300' height='300' fill='%23E8C8C3'/%3E%3C/svg%3E";

const products: Product[] = [
  {
    id: 'mini-soul-snapshot',
    name: 'Mini Soul Snapshot',
    price: 44,
    checkoutUrl: process.env.NEXT_PUBLIC_STRIPE_MINI_SOUL_SNAPSHOT,
  },
  {
    id: 'lite-soul-reading',
    name: 'Lite Soul Reading',
    price: 88,
    checkoutUrl: process.env.NEXT_PUBLIC_STRIPE_LITE_SOUL_READING,
  },
  {
    id: 'full-soul-blueprint',
    name: 'Full Soul Blueprint',
    price: 144,
    checkoutUrl: process.env.NEXT_PUBLIC_STRIPE_FULL_SOUL_BLUEPRINT,
  },
  {
    id: 'realignment-blueprint',
    name: 'Realignment Blueprint',
    price: 77,
    checkoutUrl: process.env.NEXT_PUBLIC_STRIPE_REALIGNMENT_BLUEPRINT,
  },
  {
    id: 'addon-reading-44',
    name: 'Add-on Reading',
    price: 44,
    checkoutUrl: process.env.NEXT_PUBLIC_STRIPE_ADDON_44,
  },
  {
    id: 'addon-reading-55',
    name: 'Add-on Reading',
    price: 55,
    checkoutUrl: process.env.NEXT_PUBLIC_STRIPE_ADDON_55,
  },
  {
    id: 'addon-reading-111',
    name: 'Add-on Reading',
    price: 111,
    checkoutUrl: process.env.NEXT_PUBLIC_STRIPE_ADDON_111,
  },
  {
    id: 'gift-magnet-board',
    name: 'Gift a Magnet Board for a Guest',
    price: 142,
    checkoutUrl: process.env.NEXT_PUBLIC_STRIPE_GIFT_MAGNET_BOARD,
  },
];

export default function ShopPage() {
  return (
    <section className="py-12">
      <h1 className="mb-6 text-center font-heading text-3xl">Shop</h1>
      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
        {products.map((p) => (
          <div
            key={p.id}
            className="flex flex-col items-center rounded-lg bg-white/80 p-4 text-center shadow-sm"
          >
            <Image
              src={p.image || placeholder}
              alt={p.name}
              width={300}
              height={300}
              className="h-48 w-full rounded object-cover"
            />
            <h3 className="mt-4 font-heading">{p.name}</h3>
            <p className="mt-2 text-brand-ink/80">${p.price.toFixed(2)}</p>
            {p.checkoutUrl ? (
              <Link
                href={p.checkoutUrl}
                className="mt-4 inline-block rounded-md bg-brand-sage px-4 py-2 text-white"
              >
                Buy
              </Link>
            ) : (
              <p className="mt-4 text-brand-ink/60">Unavailable</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
