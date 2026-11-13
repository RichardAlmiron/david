import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatGuaraniesCompact,
  getOrdersForProductPage,
  getOrderStatusLabel,
  matchesProductToOrder
} from '../../src/utils/mobileOrderHelpers';
import { Order, ProductPage } from '../../src/types';

const prodMain: ProductPage = {
  id: 'prod-noelux-01',
  slug: 'noelux-proyector',
  nombre: 'Noelux™ Proyector Navideño 12 Diseños',
  precio: 'Gs. 189.000',
  precioNumerico: 189000,
  imagen: '/assets/real/galeria-1.jpg',
  descripcion: 'Proyector LED',
  badge: 'Más Vendido',
  beneficios: ['Envío gratis'],
  rating: 4.9,
  reviewsCount: 120
};

const prodSecond: ProductPage = {
  id: 'prod-laser-02',
  slug: 'laser-exterior',
  nombre: 'Foco Láser Exterior RGB',
  precio: 'Gs. 220.000',
  precioNumerico: 220000,
  imagen: '/assets/real/galeria-2.jpg',
  descripcion: 'Foco láser',
  badge: 'Nuevo',
  beneficios: ['Resistente al agua'],
  rating: 4.8,
  reviewsCount: 45
};

const sampleOrders: Order[] = [
  {
    reservaid: 'NX-001',
    fecha: '2026-11-10T10:00:00.000Z',
    nombre: 'Carlos Benítez',
    celular: '0981111111',
    ciudad: 'Asunción',
    direccion: 'Villa Morra',
    cantidad: 1,
    monto: 189000,
    producto: 'Noelux™ Proyector Navideño 12 Diseños',
    productoId: 'prod-noelux-01',
    estado: 'pendiente',
    datosConfirmados: true
  },
  {
    reservaid: 'NX-002',
    fecha: '2026-11-11T12:00:00.000Z',
    nombre: 'Lucía Vera',
    celular: '0982222222',
    ciudad: 'Luque',
    direccion: 'Centro',
    cantidad: 1,
    monto: 220000,
    producto: 'Foco Láser Exterior RGB',
    productoId: 'prod-laser-02',
    estado: 'entregado_pagado'
  },
  {
    reservaid: 'NX-003',
    fecha: '2026-11-12T08:00:00.000Z',
    nombre: 'Pedido Legacy Sin ID',
    celular: '0983333333',
    ciudad: 'San Lorenzo',
    direccion: 'Barrio Universitario',
    cantidad: 1,
    monto: 189000,
    producto: 'Proyector Clásico',
    estado: 'pendiente',
    archivado: false
  },
  {
    reservaid: 'NX-004',
    fecha: '2026-11-12T09:00:00.000Z',
    nombre: 'Archivado',
    celular: '0984444444',
    ciudad: 'Lambaré',
    direccion: 'Centro',
    cantidad: 1,
    monto: 189000,
    productoId: 'prod-noelux-01',
    estado: 'cancelado',
    archivado: true
  }
];

test('matchesProductToOrder matches by productoId or product name prefix', () => {
  assert.equal(matchesProductToOrder(sampleOrders[0], prodMain), true);
  assert.equal(matchesProductToOrder(sampleOrders[1], prodMain), false);
  assert.equal(matchesProductToOrder(sampleOrders[1], prodSecond), true);
});

test('getOrdersForProductPage groups legacy unmapped orders under first product and excludes archived', () => {
  const allProducts = [prodMain, prodSecond];
  const mainOrders = getOrdersForProductPage(sampleOrders, prodMain, allProducts);
  assert.deepEqual(
    mainOrders.map(o => o.reservaid),
    ['NX-003', 'NX-001']
  );

  const secondOrders = getOrdersForProductPage(sampleOrders, prodSecond, allProducts);
  assert.deepEqual(
    secondOrders.map(o => o.reservaid),
    ['NX-002']
  );
});

test('formatGuaraniesCompact and getOrderStatusLabel return Spanish labels and formatted PYG', () => {
  assert.equal(formatGuaraniesCompact(189000), 'Gs. 189.000');
  assert.equal(getOrderStatusLabel(sampleOrders[0]).tone, 'confirmed');
  assert.equal(getOrderStatusLabel(sampleOrders[1]).tone, 'delivered');
  assert.equal(getOrderStatusLabel(sampleOrders[2]).tone, 'in_progress');
  assert.equal(getOrderStatusLabel(sampleOrders[3]).tone, 'cancelled');
});
