import React from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';

interface StockMovement {
  id: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  reason: string;
  timestamp: Date;
  reference?: string;
  user: {
    name: string;
  };
}

export const StockMovementTimeline = ({
  movements
}: {
  movements: StockMovement[];
}) => {
  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {movements.map((movement, idx) => (
          <motion.li
            key={movement.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="relative pb-8"
          >
            {idx !== movements.length - 1 && (
              <span
                className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                aria-hidden="true"
              />
            )}
            <div className="relative flex space-x-3">
              <div>
                <span
                  className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                    movement.type === 'IN'
                      ? 'bg-green-500'
                      : movement.type === 'OUT'
                      ? 'bg-red-500'
                      : 'bg-yellow-500'
                  }`}
                >
                  {movement.type === 'IN' ? (
                    <PlusIcon className="h-5 w-5 text-white" />
                  ) : movement.type === 'OUT' ? (
                    <MinusIcon className="h-5 w-5 text-white" />
                  ) : (
                    <AdjustIcon className="h-5 w-5 text-white" />
                  )}
                </span>
              </div>
              <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                <div>
                  <p className="text-sm text-gray-500">
                    {movement.type === 'IN'
                      ? 'Stock received'
                      : movement.type === 'OUT'
                      ? 'Stock removed'
                      : 'Stock adjusted'}{' '}
                    <span className="font-medium text-gray-900">
                      {Math.abs(movement.quantity)} units
                    </span>{' '}
                    {movement.reason}
                  </p>
                  {movement.reference && (
                    <p className="text-sm text-gray-500">
                      Ref: {movement.reference}
                    </p>
                  )}
                </div>
                <div className="text-right text-sm whitespace-nowrap text-gray-500">
                  <time dateTime={movement.timestamp.toISOString()}>
                    {format(movement.timestamp, 'MMM d, h:mm a')}
                  </time>
                  <p>{movement.user.name}</p>
                </div>
              </div>
            </div>
          </motion.li>
        ))}
      </ul>
    </div>
  );
};

const PlusIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
    />
  </svg>
);

const MinusIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M20 12H4"
    />
  </svg>
);

const AdjustIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
    />
  </svg>
); 