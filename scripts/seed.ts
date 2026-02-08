/**
 * Database Seed Script
 * 
 * Creates initial Super Admin user and sample hotel
 * Run with: npx tsx scripts/seed.ts
 */

import mongoose from 'mongoose';
import * as argon2 from 'argon2';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hotel_management';

// Schema definitions (simplified for seed script)
const HotelSchema = new mongoose.Schema({
    name: String,
    slug: String,
    email: String,
    phone: String,
    address: {
        street: String,
        city: String,
        country: String,
        postalCode: String,
    },
    subscription: {
        plan: { type: String, default: 'premium' },
        status: { type: String, default: 'active' },
        startDate: { type: Date, default: Date.now },
    },
    settings: {
        currency: { type: String, default: 'SAR' },
        timezone: { type: String, default: 'Asia/Riyadh' },
        language: { type: String, default: 'ar' },
        checkInTime: { type: String, default: '14:00' },
        checkOutTime: { type: String, default: '12:00' },
    },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

const UserSchema = new mongoose.Schema({
    hotelId: mongoose.Schema.Types.ObjectId,
    email: String,
    passwordHash: String,
    name: String,
    role: String,
    permissions: [String],
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

const RoomSchema = new mongoose.Schema({
    hotelId: mongoose.Schema.Types.ObjectId,
    roomNumber: String,
    floor: Number,
    type: String,
    status: { type: String, default: 'available' },
    pricePerNight: Number,
    capacity: { adults: Number, children: Number },
    amenities: [String],
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

async function seed() {
    console.log('🌱 Starting database seed...\n');

    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        const Hotel = mongoose.models.Hotel || mongoose.model('Hotel', HotelSchema);
        const User = mongoose.models.User || mongoose.model('User', UserSchema);
        const Room = mongoose.models.Room || mongoose.model('Room', RoomSchema);

        // Check if already seeded
        const existingSuperAdmin = await User.findOne({ role: 'super_admin' });
        if (existingSuperAdmin) {
            console.log('⚠️  Database already seeded. Exiting...');
            await mongoose.disconnect();
            return;
        }

        // Create Super Admin
        console.log('👤 Creating Super Admin...');
        const superAdminPassword = await argon2.hash('Admin123!');
        const superAdmin = await User.create({
            hotelId: null,
            email: 'admin@hms.com',
            passwordHash: superAdminPassword,
            name: 'مدير النظام',
            role: 'super_admin',
            permissions: [],
            isActive: true,
        });
        console.log(`   ✅ Super Admin created: admin@hms.com`);

        // Create Sample Hotel
        console.log('\n🏨 Creating sample hotel...');
        const hotel = await Hotel.create({
            name: 'فندق ربيع الأحلام',
            slug: 'rabie-alahlam',
            email: 'info@rabie-hotel.com',
            phone: '+966501234567',
            address: {
                street: 'شارع الملك فهد',
                city: 'الرياض',
                country: 'السعودية',
                postalCode: '12345',
            },
        });
        console.log(`   ✅ Hotel created: ${hotel.name}`);

        // Create Hotel Admin
        console.log('\n👤 Creating hotel admin...');
        const adminPassword = await argon2.hash('Hotel123!');
        const hotelAdmin = await User.create({
            hotelId: hotel._id,
            email: 'manager@rabie-hotel.com',
            passwordHash: adminPassword,
            name: 'أحمد المدير',
            role: 'admin',
            permissions: [],
            isActive: true,
        });
        console.log(`   ✅ Hotel Admin created: manager@rabie-hotel.com`);

        // Create Sample Rooms
        console.log('\n🛏️  Creating sample rooms...');
        const roomsData = [
            { roomNumber: '101', floor: 1, type: 'single', pricePerNight: 300, capacity: { adults: 1, children: 0 }, amenities: ['تكييف', 'واي فاي', 'تلفزيون'] },
            { roomNumber: '102', floor: 1, type: 'double', pricePerNight: 450, capacity: { adults: 2, children: 1 }, amenities: ['تكييف', 'واي فاي', 'تلفزيون', 'ميني بار'] },
            { roomNumber: '103', floor: 1, type: 'twin', pricePerNight: 400, capacity: { adults: 2, children: 0 }, amenities: ['تكييف', 'واي فاي', 'تلفزيون'] },
            { roomNumber: '201', floor: 2, type: 'suite', pricePerNight: 800, capacity: { adults: 2, children: 2 }, amenities: ['تكييف', 'واي فاي', 'تلفزيون', 'ميني بار', 'جاكوزي', 'غرفة معيشة'] },
            { roomNumber: '202', floor: 2, type: 'deluxe', pricePerNight: 600, capacity: { adults: 2, children: 1 }, amenities: ['تكييف', 'واي فاي', 'تلفزيون', 'ميني بار', 'بلكونة', 'إطلالة حديقة'] },
            { roomNumber: '301', floor: 3, type: 'presidential', pricePerNight: 1500, capacity: { adults: 4, children: 2 }, amenities: ['تكييف', 'واي فاي', 'تلفزيون', 'ميني بار', 'جاكوزي', 'غرفة معيشة', 'مطبخ صغير', 'إطلالة بحرية'] },
        ];

        for (const roomData of roomsData) {
            await Room.create({ ...roomData, hotelId: hotel._id });
            console.log(`   ✅ Room ${roomData.roomNumber} created`);
        }

        console.log('\n' + '='.repeat(50));
        console.log('🎉 Database seeded successfully!\n');
        console.log('📋 Login Credentials:');
        console.log('   Super Admin: admin@hms.com / Admin123!');
        console.log('   Hotel Admin: manager@rabie-hotel.com / Hotel123!');
        console.log('='.repeat(50) + '\n');

        await mongoose.disconnect();

    } catch (error) {
        console.error('❌ Seed failed:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

seed();
