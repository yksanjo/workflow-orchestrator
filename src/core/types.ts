/**
 * Core Types for Workflow Orchestrator
 */

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface StepInput {
  [key: string]: any;
}

export interface StepOutput {
  [key: string]: any;
}

export interface StepResult {
  stepId: string;
  status: StepStatus;
  output?: StepOutput;
  error?: string;
  startTime: number;
  endTime?: number;
}

export interface WorkflowStep {
  id: string;
  name: string;
  action: StepAction;
  dependencies?: string[];
  retryable?: boolean;
  maxRetries?: number;
}

export type StepAction = (input: StepInput) => Promise<StepOutput>;

export interface WorkflowDefinition {
  id: string;
  name: string;
  steps: WorkflowStep[];
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  stepResults: Map<string, StepResult>;
  startTime: number;
  endTime?: number;
  input: StepInput;
  output?: StepOutput;
}
