# Age of Shadows - Current Issues & Status

**Updated: June 20, 2026**

## 🔴 CRITICAL ISSUES

### 1. **Food Resource Lost on Page Refresh During Build** 
- **Problem**: User spent 40 food to build 4 men, page refreshed before first man spawned
- **Result**: Food was deducted but units not created; food not refunded
- **Root Cause**: BuildQueue only exists in memory; lost on disconnect/refresh
- **Solution Needed**: 
  - Save buildQueue to database
  - Or refund resources if build cancelled
  - Or resume builds on reconnect

### 2. **UI Button Clicks Not Registering**
- **Affected Buttons**: Inventory, Logout, Build Menu
- **Problem**: addEventListener and onclick handlers not firing despite correct implementation
- **Symptoms**: Click coordinates verified correct, no errors in console
- **Attempts Made**: 
  - Changed from `onclick = ` to `addEventListener`
  - Added z-index and pointer-events CSS
  - Verified buttons exist in DOM
- **Status**: UNRESOLVED - may be React rendering issue or event capture by canvas

## 🟡 PARTIALLY COMPLETE FEATURES

### 1. **Two-Row Inventory Modal**
- ✅ Code complete with proper styling
- ✅ Correctly shows "YOUR INVENTORY" and "TOWN CENTER STORAGE" 
- ❌ Modal can't open due to button click issue
- **Impact**: User can't view inventory or resources

### 2. **Build Progress Indicators**
- ✅ Added left-side build queue display with timer
- ✅ Shows emoji icon + progress bar + remaining time
- ❌ Can't test without ability to start builds
- **Expected Display**: Icons on far left showing construction progress

### 3. **Title Display**
- ✅ "⚔️ AGE OF SHADOWS ⚔️ v2.14" correctly visible at top center
- ✅ Proper z-index (10000) ensures visibility

## 🟢 WORKING FEATURES

- ✅ Game initialization and 3D rendering
- ✅ Player character spawning  
- ✅ Town center and building models
- ✅ Resource tracking (wood, food, stone, gold, water)
- ✅ Unit movement and gathering
- ✅ Chat system
- ✅ Title with crossed swords
- ✅ Toast notifications for events

## 📋 FEATURES NOT YET TESTED

Due to button click issue:
- Inventory display
- Build menu interface
- Logout functionality
- Build placement system
- Man unit spawning confirmation

## 🔧 TECHNICAL DEBT

1. **Event Handler System** - Need to diagnose why DOM events aren't firing
2. **Build Persistence** - BuildQueue lost on disconnect
3. **Resource Synchronization** - Food deduction without build completion
4. **Build Feedback** - No visual indication of start/cancel/completion

## 📊 Summary

**What's Working**: Core game engine, 3D rendering, networking
**What's Blocked**: UI interactions (buttons), inventory system, build feedback
**What Needs Fixing**: Button click handlers, resource persistence, build system

## 🎯 Priority Fixes Needed

1. **URGENT**: Fix button click detection (blocks testing entire UI)
2. **CRITICAL**: Implement build queue persistence (prevents resource loss)
3. **HIGH**: Test and verify inventory two-row display works
4. **HIGH**: Verify build progress indicators display correctly
5. **MEDIUM**: Add build cancellation with refund option

## 🚀 Next Steps

1. Debug why event listeners not firing on UI buttons
2. Implement database persistence for build queue
3. Add resource refund mechanism on build cancel/disconnect
4. Full integration testing once buttons work
5. Player testing and feedback collection
