import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface StockLevelIndicatorProps {
  currentStock: number;
  reorderLevel: number;
  maxStock: number;
}

export const StockLevelIndicator = ({
  currentStock,
  reorderLevel,
  maxStock
}: StockLevelIndicatorProps) => {
  const percentage = (currentStock / maxStock) * 100;
  const isLow = currentStock <= reorderLevel;

  const getColor = () => {
    if (percentage <= 25) return 'bg-red-500';
    if (percentage <= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span>Stock Level</span>
        <span>{currentStock} / {maxStock}</span>
      </div>
      
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <motion.div
          className={`h-full ${getColor()}`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      <AnimatePresence>
        {isLow && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-sm text-red-600 flex items-center space-x-1"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Low stock alert</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}; 