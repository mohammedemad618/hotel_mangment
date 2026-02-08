/**
 * Remove sample hotel data (rabie-alahlam).
 *
 * Run with:
 *   MONGODB_URI="mongodb+srv://..." npx tsx scripts/remove-sample-hotel.ts
 */

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || '';
const SAMPLE_HOTEL_SLUG = process.env.SAMPLE_HOTEL_SLUG || 'rabie-alahlam';
const SAMPLE_HOTEL_EMAIL = process.env.SAMPLE_HOTEL_EMAIL || 'info@rabie-hotel.com';

if (!MONGODB_URI) {
    console.error('MONGODB_URI is required.');
    process.exit(1);
}

const HotelSchema = new mongoose.Schema(
    {
        name: String,
        slug: String,
        email: String,
    },
    { timestamps: true }
);

const UserSchema = new mongoose.Schema({ hotelId: mongoose.Schema.Types.ObjectId }, { timestamps: true });
const RoomSchema = new mongoose.Schema({ hotelId: mongoose.Schema.Types.ObjectId }, { timestamps: true });
const GuestSchema = new mongoose.Schema({ hotelId: mongoose.Schema.Types.ObjectId }, { timestamps: true });
const BookingSchema = new mongoose.Schema({ hotelId: mongoose.Schema.Types.ObjectId }, { timestamps: true });

async function run() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB.');

        const Hotel = mongoose.models.Hotel || mongoose.model('Hotel', HotelSchema);
        const User = mongoose.models.User || mongoose.model('User', UserSchema);
        const Room = mongoose.models.Room || mongoose.model('Room', RoomSchema);
        const Guest = mongoose.models.Guest || mongoose.model('Guest', GuestSchema);
        const Booking = mongoose.models.Booking || mongoose.model('Booking', BookingSchema);

        const hotel = await Hotel.findOne({
            $or: [{ slug: SAMPLE_HOTEL_SLUG }, { email: SAMPLE_HOTEL_EMAIL }],
        });

        if (!hotel) {
            console.log('Sample hotel not found. Nothing to delete.');
            await mongoose.disconnect();
            return;
        }

        console.log(`Found sample hotel: ${hotel.name} (${hotel._id})`);

        const [roomsCount, guestsCount, bookingsCount, usersCount] = await Promise.all([
            Room.countDocuments({ hotelId: hotel._id }),
            Guest.countDocuments({ hotelId: hotel._id }),
            Booking.countDocuments({ hotelId: hotel._id }),
            User.countDocuments({ hotelId: hotel._id }),
        ]);

        const [bookingsResult, guestsResult, roomsResult, usersResult] = await Promise.all([
            Booking.deleteMany({ hotelId: hotel._id }),
            Guest.deleteMany({ hotelId: hotel._id }),
            Room.deleteMany({ hotelId: hotel._id }),
            User.deleteMany({ hotelId: hotel._id }),
        ]);

        const hotelResult = await Hotel.deleteOne({ _id: hotel._id });

        console.log('Deletion summary:');
        console.log(`- Bookings: ${bookingsResult.deletedCount ?? bookingsCount}`);
        console.log(`- Guests: ${guestsResult.deletedCount ?? guestsCount}`);
        console.log(`- Rooms: ${roomsResult.deletedCount ?? roomsCount}`);
        console.log(`- Users: ${usersResult.deletedCount ?? usersCount}`);
        console.log(`- Hotel: ${hotelResult.deletedCount ?? 0}`);

        await mongoose.disconnect();
        console.log('Done.');
    } catch (error) {
        console.error('Cleanup failed:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

run();
