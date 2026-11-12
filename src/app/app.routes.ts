import { Routes } from '@angular/router';

import { TablitaGeneratorComponent } from './features/generator/components/tablita-generator/tablita-generator.component';

export const routes: Routes = [
  { path: '', component: TablitaGeneratorComponent, title: 'Gerador de Tablita – Damas Brasileiras' },
  { path: '**', redirectTo: '' },
];
