const { PrismaClient } = require('../generated/prisma');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  // Create roles and permissions
  const adminPermission = await prisma.permission.create({
    data: {
      name: 'ADMIN',
      description: 'Full system access',
    },
  });

  const managerPermission = await prisma.permission.create({
    data: {
      name: 'MANAGER',
      description: 'Manager level access',
    },
  });

  const staffPermission = await prisma.permission.create({
    data: {
      name: 'STAFF',
      description: 'Staff level access',
    },
  });

  const cashierPermission = await prisma.permission.create({
    data: {
      name: 'CASHIER',
      description: 'Cashier level access',
    },
  });

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.create({
    data: {
      email: 'admin@pos.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      permissions: {
        connect: [
          { id: adminPermission.id },
          { id: managerPermission.id },
          { id: staffPermission.id },
          { id: cashierPermission.id },
        ],
      },
    },
  });

  // Create categories
  const electronics = await prisma.category.create({
    data: {
      name: 'Electronics',
      description: 'Electronic devices and accessories',
    },
  });

  const clothing = await prisma.category.create({
    data: {
      name: 'Clothing',
      description: 'Apparel and accessories',
    },
  });

  const food = await prisma.category.create({
    data: {
      name: 'Food',
      description: 'Food and beverages',
    },
  });

  // Create products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: 'Smartphone X',
        description: 'Latest smartphone model',
        sku: 'ELEC-001',
        barcode: '123456789012',
        price: 999.99,
        cost: 699.99,
        categoryId: electronics.id,
        inventory: {
          create: {
            quantity: 50,
            lowStock: 5,
            reorderPoint: 10,
          },
        },
      },
    }),
    prisma.product.create({
      data: {
        name: 'Laptop Pro',
        description: 'High-performance laptop',
        sku: 'ELEC-002',
        barcode: '123456789013',
        price: 1499.99,
        cost: 999.99,
        categoryId: electronics.id,
        inventory: {
          create: {
            quantity: 30,
            lowStock: 3,
            reorderPoint: 5,
          },
        },
      },
    }),
    prisma.product.create({
      data: {
        name: 'T-Shirt',
        description: 'Cotton t-shirt',
        sku: 'CLOTH-001',
        barcode: '123456789014',
        price: 19.99,
        cost: 9.99,
        categoryId: clothing.id,
        inventory: {
          create: {
            quantity: 100,
            lowStock: 10,
            reorderPoint: 20,
          },
        },
      },
    }),
    prisma.product.create({
      data: {
        name: 'Jeans',
        description: 'Classic blue jeans',
        sku: 'CLOTH-002',
        barcode: '123456789015',
        price: 49.99,
        cost: 24.99,
        categoryId: clothing.id,
        inventory: {
          create: {
            quantity: 75,
            lowStock: 8,
            reorderPoint: 15,
          },
        },
      },
    }),
    prisma.product.create({
      data: {
        name: 'Bottled Water',
        description: '500ml bottled water',
        sku: 'FOOD-001',
        barcode: '123456789016',
        price: 1.99,
        cost: 0.99,
        categoryId: food.id,
        inventory: {
          create: {
            quantity: 200,
            lowStock: 20,
            reorderPoint: 40,
          },
        },
      },
    }),
  ]);

  // Create discounts
  const discounts = await Promise.all([
    prisma.discount.create({
      data: {
        name: 'Summer Sale',
        description: '20% off on all electronics',
        type: 'PERCENTAGE',
        value: 20,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        isActive: true,
        products: {
          connect: products
            .filter(p => p.categoryId === electronics.id)
            .map(p => ({ id: p.id })),
        },
      },
    }),
    prisma.discount.create({
      data: {
        name: 'Buy One Get One',
        description: 'Buy one get one free on bottled water',
        type: 'BUY_ONE_GET_ONE',
        value: 0,
        startDate: new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        isActive: true,
        products: {
          connect: products
            .filter(p => p.categoryId === food.id)
            .map(p => ({ id: p.id })),
        },
      },
    }),
  ]);

  console.log('Database has been seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 