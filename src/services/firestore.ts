// Firestore Service Layer for Roadside Assistance App
// 🚀 REFACTORED: Now using modular architecture for better maintainability

// Re-export all functions from the new modular structure
export * from './firestore/index';

// This file now serves as a compatibility layer for existing imports
// All functions have been split into focused modules:
// - orders.ts (350 lines) - Order CRUD operations
// - bids.ts (300 lines) - Bid management
// - users.ts (120 lines) - User/driver operations
// - locations.ts (50 lines) - Location tracking
// - migrations.ts (200 lines) - Image migration utilities
// - analytics.ts (100 lines) - Analytics operations
// - index.ts - Re-exports all functions

// Total: ~1120 lines split into 7 focused modules averaging ~160 lines each
// Original file: 1549 lines → Now: 7 modules of 50-350 lines each ✅ 