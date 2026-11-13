import { Order, ProductPage } from '../types';
import { isOrderConfirmedByAgent } from './orderConfirmation';

export function matchesProductToOrder(order: Order, targetProd: ProductPage): boolean {
  if (order.productoId && order.productoId === targetProd.id) return true;
  if (
    order.producto &&
    targetProd.nombre &&
    order.producto.toLowerCase().includes(targetProd.nombre.toLowerCase().slice(0, 10))
  ) {
    return true;
  }
  return false;
}

export function getOrdersForProductPage(
  orders: Order[],
  product: ProductPage,
  allProducts: ProductPage[]
): Order[] {
  const prodIdx = allProducts.findIndex(p => p.id === product.id);
  return orders
    .filter(o => {
      if (o.archivado) return false;
      if (matchesProductToOrder(o, product)) return true;
      if (prodIdx === 0) {
        const matchesAnyOther = allProducts.some(
          (otherP, otherIdx) => otherIdx !== 0 && matchesProductToOrder(o, otherP)
        );
        return !matchesAnyOther;
      }
      return false;
    })
    .sort((a, b) => {
      const ta = a.fecha ? new Date(a.fecha).getTime() : 0;
      const tb = b.fecha ? new Date(b.fecha).getTime() : 0;
      return tb - ta;
    });
}

export function formatGuaraniesCompact(value?: number | string): string {
  const num = Number(String(value ?? 0).replace(/[^\d.-]/g, '')) || 0;
  return `Gs. ${Math.round(num).toLocaleString('es-PY')}`;
}

export function getOrderStatusLabel(order: Order): {
  label: string;
  tone: 'confirmed' | 'in_progress' | 'delivered' | 'cancelled';
} {
  if (order.estado === 'cancelado') {
    return { label: 'Cancelado', tone: 'cancelled' };
  }
  if (order.estado === 'entregado_pagado') {
    return { label: 'Entregado y Pagado', tone: 'delivered' };
  }
  if (isOrderConfirmedByAgent(order)) {
    return { label: 'Confirmado para Despacho', tone: 'confirmed' };
  }
  return { label: 'En Confirmación', tone: 'in_progress' };
}
