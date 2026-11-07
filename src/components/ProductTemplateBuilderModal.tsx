import React from 'react';
import {
  ProductTemplateBuilderStudio,
  ProductTemplateBuilderStudioProps
} from './ProductTemplateBuilderStudio';

export type ProductTemplateBuilderModalProps = ProductTemplateBuilderStudioProps;

export function computePackLadderFromUnit(unitPriceGs: number): Record<number, number> {
  const cleanUnit = Math.max(10000, Math.round(Number(unitPriceGs) || 0));
  const roundTo9000 = (val: number) => {
    if (val < 50000) return Math.round(val / 1000) * 1000;
    const thousands = Math.max(59, Math.round(val / 1000));
    const baseTen = Math.floor(thousands / 10) * 10 + 9;
    return baseTen * 1000;
  };
  const p1 = cleanUnit;
  const p2 = Math.max(p1 + 30000, roundTo9000(p1 * 1.84));
  const p3 = Math.max(p2 + 40000, roundTo9000(p1 * 2.58));
  return {
    1: p1,
    2: p2,
    3: p3
  };
}

export const ProductTemplateBuilderModal: React.FC<ProductTemplateBuilderModalProps> = props => {
  return <ProductTemplateBuilderStudio {...props} />;
};
