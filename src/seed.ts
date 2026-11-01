import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from './config/database.js';
import Role, { ADMIN_TABS_LIST, TabAction } from './models/role.js';
import User, { UserType } from './models/user.js';
import RegistrationFee from './models/registrationFee.js';

const ADMIN_EMAIL = 'admin@maideazy.com';
const ADMIN_PASSWORD = 'admin@123';
const ADMIN_NAME = 'MaidEazy Admin';

async function seed() {
    try {
        console.log('🌱 Starting database seeding...');
        await connectDB();

        // 1. Seed Super Admin Role
        console.log('Checking Admin Role...');
        const allPermissions = ADMIN_TABS_LIST.map((tab) => ({
            tab,
            actions: [
                TabAction.ALL,
                TabAction.CREATE,
                TabAction.READ,
                TabAction.UPDATE,
                TabAction.DELETE,
            ],
        }));

        let adminRole = await Role.findOne({ name: 'Super Admin', isDeleted: false });
        if (!adminRole) {
            adminRole = await Role.create({
                name: 'Super Admin',
                description: 'Full system administrator with access to all tabs and actions',
                permissions: allPermissions,
                isActive: true,
                isDeleted: false,
                deletedAt: null,
            });
            console.log('✅ Created Super Admin role');
        } else {
            adminRole.permissions = allPermissions;
            adminRole.isActive = true;
            adminRole.isDeleted = false;
            adminRole.deletedAt = null;
            await adminRole.save();
            console.log('ℹ️ Super Admin role already exists. Permissions synchronized.');
        }

        // Also create a default Sales Person Role if not existing
        let salesRole = await Role.findOne({ name: 'Sales Person', isDeleted: false });
        if (!salesRole) {
            await Role.create({
                name: 'Sales Person',
                description: 'Sales team role for registering and managing service providers',
                permissions: [
                    { tab: 'dashboard', actions: [TabAction.READ] },
                    { tab: 'service_providers', actions: [TabAction.CREATE, TabAction.READ] },
                ],
                isActive: true,
                isDeleted: false,
                deletedAt: null,
            });
            console.log('✅ Created default Sales Person role');
        }

        // 2. Seed Admin User
        console.log(`Checking Admin User (${ADMIN_EMAIL})...`);
        let adminUser = await User.findOne({ email: ADMIN_EMAIL }).select('+password');

        if (!adminUser) {
            adminUser = await User.create({
                fullName: ADMIN_NAME,
                email: ADMIN_EMAIL,
                password: ADMIN_PASSWORD,
                role: adminRole._id,
                userType: UserType.ADMIN,
                isActive: true,
            });
            console.log('✅ Admin user created successfully!');
        } else {
            // Update role and password
            adminUser.role = adminRole._id;
            adminUser.userType = UserType.ADMIN;
            adminUser.isActive = true;
            adminUser.password = ADMIN_PASSWORD; // Triggers pre-save bcrypt hash
            await adminUser.save();
            console.log('ℹ️ Admin user already exists. Password & Role updated successfully!');
        }

        // 3. Seed Active Registration Fee & Features
        console.log('Checking Registration Fee Configuration...');
        let activeFee = await RegistrationFee.findOne({ isActive: true });
        if (!activeFee) {
            activeFee = await RegistrationFee.create({
                title: 'Service Provider Registration Fee',
                amount: 499,
                originalAmount: 999,
                currency: 'INR',
                features: [
                    'Verified Service Provider Profile Badge',
                    'Direct Job Alerts in Your Preferred Locations',
                    'No Commission on Initial Bookings',
                    'Dedicated Support Team Access',
                    'Instant SMS & Notification Updates',
                ],
                description: 'One-time registration fee to activate provider account',
                validityInDays: 365,
                isActive: true,
                createdBy: adminUser._id,
                updatedBy: adminUser._id,
            });
            console.log('✅ Created default active Registration Fee (₹499)');
        } else {
            console.log(`ℹ️ Active Registration Fee already configured: ₹${activeFee.amount}`);
        }

        console.log('\n===========================================');
        console.log('🎉 Seeding completed successfully!');
        console.log('===========================================');
        console.log('🔑 Admin Login Credentials:');
        console.log(`   Email:    ${ADMIN_EMAIL}`);
        console.log(`   Password: ${ADMIN_PASSWORD}`);
        console.log(`   Role:     ${adminRole.name}`);
        console.log('===========================================\n');
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Database connection closed');
        process.exit(0);
    }
}

seed();
