'use client';

import { useState } from 'react';
import type { EmployeeListItem, ProjectDetail } from '@/lib/api';
import { cn } from '@/lib/utils';
import { GeneralTab } from './general-tab';
import { TeamTab } from './team-tab';
import { FinancialsTab } from './financials-tab';
import { DocumentsTab } from './documents-tab';
import { ProfitabilityTab } from './profitability-tab';
import { OperationsTab } from './operations-tab';

type TabId = 'general' | 'team' | 'financials' | 'documents' | 'profitability' | 'operations';

const TABS: { id: TabId; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'team', label: 'Equipo' },
  { id: 'financials', label: 'Financiero' },
  { id: 'documents', label: 'Documentos' },
  { id: 'profitability', label: 'Rentabilidad' },
  { id: 'operations', label: 'Operaciones' },
];

interface Props {
  project: ProjectDetail;
  employees: EmployeeListItem[];
}

export function ProjectDetailScreen({ project, employees }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [currentProject, setCurrentProject] = useState<ProjectDetail>(project);

  function refreshProject(updated: ProjectDetail) {
    setCurrentProject(updated);
  }

  return (
    <div>
      {/* Tabs */}
      <div className="mb-6 flex border-b border-slate-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'border-b-2 border-black text-black'
                : 'text-slate-500 hover:text-navy',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'general' && (
        <GeneralTab project={currentProject} onUpdate={refreshProject} />
      )}
      {activeTab === 'team' && (
        <TeamTab project={currentProject} employees={employees} onUpdate={refreshProject} />
      )}
      {activeTab === 'financials' && (
        <FinancialsTab project={currentProject} onUpdate={refreshProject} />
      )}
      {activeTab === 'documents' && (
        <DocumentsTab project={currentProject} />
      )}
      {activeTab === 'profitability' && (
        <ProfitabilityTab project={currentProject} />
      )}
      {activeTab === 'operations' && (
        <OperationsTab project={currentProject} />
      )}
    </div>
  );
}
