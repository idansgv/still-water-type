// Explode: anchored columns that blow into triangular slabs, and set each other off. See columns-core.js.
import { mountColumns } from './columns-core.js';
export const mount = (stage) => mountColumns(stage, 'explode');
