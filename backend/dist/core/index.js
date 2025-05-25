"use strict";
/**
 * index.ts
 *
 * This file exports all core components from the core directory.
 * Location: backend/src/core/index.ts
 *
 * Responsibilities:
 * - Provide a single import point for core components
 * - Export schemas, types, and utility functions
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MARKET_HOURS = exports.ArtificialOrderManager = exports.ConfigManager = void 0;
// Export schemas and types
__exportStar(require("./schemas"), exports);
// Export configuration manager
var config_manager_1 = require("./config-manager");
Object.defineProperty(exports, "ConfigManager", { enumerable: true, get: function () { return config_manager_1.ConfigManager; } });
// Export artificial orders manager
var artificial_orders_1 = require("./artificial-orders");
Object.defineProperty(exports, "ArtificialOrderManager", { enumerable: true, get: function () { return artificial_orders_1.ArtificialOrderManager; } });
// Export market hours constants
var schemas_1 = require("./schemas");
Object.defineProperty(exports, "MARKET_HOURS", { enumerable: true, get: function () { return schemas_1.MARKET_HOURS; } });
// Export error types and utilities
__exportStar(require("./errors"), exports);
