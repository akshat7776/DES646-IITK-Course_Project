import type { Product } from './types';

export const products: Product[] = [
  {
    id: 'prod-1',
    name: "Women's Floral Print Blouse",
    department: 'Womens',
    productAge: '6 months',
    imageId: 'product-1',
    reviews: [
      {
        id: 1,
        author: 'Sarah J.',
        date: '2023-10-15',
        rating: 5,
        text: "Absolutely love this blouse! The fabric is so light and comfortable, and the floral print is beautiful. I've received so many compliments.",
      },
      {
        id: 2,
        author: 'Emily R.',
        date: '2023-10-20',
        rating: 3,
        text: "It's a nice blouse, but the sizing is a bit off. I had to exchange for a smaller size. The material is also thinner than I expected.",
      },
    ],
  },
  {
    id: 'prod-2',
    name: "Men's Classic Leather Watch",
    department: 'Mens',
    productAge: '1 year',
    imageId: 'product-2',
    reviews: [
      {
        id: 3,
        author: 'Michael B.',
        date: '2024-01-05',
        rating: 5,
        text: 'Stunning watch. It looks much more expensive than it is. The leather is high quality and it keeps perfect time. A truly classic piece.',
      },
      {
        id: 4,
        author: 'David L.',
        date: '2024-02-12',
        rating: 4,
        text: 'Great watch for the price. My only complaint is the strap was a bit stiff at first, but it has softened up with wear.',
      },
       {
        id: 5,
        author: 'Chris P.',
        date: '2024-03-22',
        rating: 2,
        text: 'Disappointed. The watch stopped working after just two months. Customer service was not helpful at all in resolving the issue.',
      },
    ],
  },
  {
    id: 'prod-3',
    name: 'Elegant Diamond Stud Earrings',
    department: 'Jewelry',
    productAge: '3 months',
    imageId: 'product-3',
    reviews: [
      {
        id: 6,
        author: 'Jessica W.',
        date: '2024-04-10',
        rating: 5,
        text: "They are absolutely breathtaking. The sparkle is incredible and they feel very secure. Perfect for special occasions or even daily wear.",
      },
    ],
  },
  {
    id: 'prod-4',
    name: "Women's High-Heel Ankle Boots",
    department: 'Shoes',
    productAge: '8 months',
    imageId: 'product-4',
    reviews: [
       {
        id: 7,
        author: 'Olivia M.',
        date: '2023-11-01',
        rating: 5,
        text: 'These boots are a dream! Super stylish and surprisingly comfortable for a high heel. I can wear them all day without any pain.',
      },
      {
        id: 8,
        author: 'Sophia T.',
        date: '2023-12-18',
        rating: 1,
        text: 'Terrible quality. The heel broke on my second time wearing them. A complete waste of money and very dangerous.',
      },
    ],
  },
   {
    id: 'prod-5',
    name: "Men's Slim-Fit Dark Wash Jeans",
    department: 'Mens',
    productAge: '2 months',
    imageId: 'product-5',
    reviews: [
      {
        id: 9,
        author: 'James H.',
        date: '2024-04-01',
        rating: 4,
        text: 'Great fit and very comfortable. The color is a nice dark wash that goes with everything. They seem durable so far.',
      },
    ],
  },
  {
    id: 'prod-6',
    name: "Sophisticated Women's Trench Coat",
    department: 'Womens',
    productAge: '1.5 years',
    imageId: 'product-6',
    reviews: [
      {
        id: 10,
        author: 'Ava G.',
        date: '2023-09-05',
        rating: 5,
        text: 'A timeless piece. The quality is exceptional and the fit is perfect. It elevates any outfit. I feel so chic wearing it.',
      },
      {
        id: 11,
        author: 'Mia C.',
        date: '2024-01-20',
        rating: 4,
        text: "I love this coat, it's very stylish. The only downside is that it wrinkles easily, so it requires a bit of maintenance.",
      },
    ],
  },
    {
    id: 'prod-7',
    name: 'Sterling Silver Pendant Necklace',
    department: 'Jewelry',
    productAge: '4 months',
    imageId: 'product-7',
    reviews: [
      {
        id: 12,
        author: 'Chloe K.',
        date: '2024-03-15',
        rating: 3,
        text: "The pendant is smaller than it looked in the pictures. It's pretty, but I was expecting something more substantial.",
      },
    ],
  },
  {
    id: 'prod-8',
    name: "Men's Classic Suede Derby Shoes",
    department: 'Shoes',
    productAge: '5 months',
    imageId: 'product-8',
    reviews: [
      {
        id: 13,
        author: 'Daniel R.',
        date: '2024-02-02',
        rating: 5,
        text: 'Fantastic shoes. The suede is soft and the color is rich. They are comfortable right out of the box. Highly recommend.',
      },
      {
        id: 14,
        author: 'Liam S.',
        date: '2024-03-30',
        rating: 4,
        text: "Very happy with these shoes. They look sharp and feel good. They do get dirty easily because they're suede, but that's to be expected.",
      },
    ],
  },
];
