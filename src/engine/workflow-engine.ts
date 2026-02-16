/**
 * Workflow Engine - DAG-based workflow execution
 */

import { 
  WorkflowDefinition, 
  WorkflowStep, 
  WorkflowExecution, 
  StepResult, 
  StepInput, 
  StepOutput,
  StepStatus 
} from '../core/types';

export class WorkflowEngine {
  private workflows: Map<string, WorkflowDefinition> = new Map();

  /**
   * Register a workflow definition
   */
  registerWorkflow(workflow: WorkflowDefinition): void {
    // Validate workflow - check for circular dependencies
    this.validateWorkflow(workflow);
    this.workflows.set(workflow.id, workflow);
  }

  /**
   * Execute a workflow
   */
  async execute(workflowId: string, input: StepInput): Promise<WorkflowExecution> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const execution: WorkflowExecution = {
      id: `exec-${Date.now()}`,
      workflowId,
      status: 'running',
      stepResults: new Map(),
      startTime: Date.now(),
      input
    };

    // Build dependency graph
    const graph = this.buildGraph(workflow);
    
    // Execute steps in topological order
    const executed = new Set<string>();
    const stepOutputs: Map<string, StepOutput> = new Map();
    
    while (executed.size < workflow.steps.length) {
      let progress = false;
      
      for (const step of workflow.steps) {
        if (executed.has(step.id)) continue;
        
        // Check if all dependencies are met
        const deps = step.dependencies || [];
        const depsMet = deps.every(d => executed.has(d));
        
        if (depsMet) {
          // Prepare input for this step
          const stepInput = this.prepareInput(step, input, stepOutputs);
          
          // Execute step
          const result = await this.executeStep(step, stepInput);
          execution.stepResults.set(step.id, result);
          stepOutputs.set(step.id, result.output || {});
          
          if (result.status === 'failed') {
            execution.status = 'failed';
            execution.endTime = Date.now();
            return execution;
          }
          
          executed.add(step.id);
          progress = true;
        }
      }
      
      if (!progress && executed.size < workflow.steps.length) {
        throw new Error('Circular dependency detected');
      }
    }

    // Combine all outputs
    execution.output = {};
    for (const output of stepOutputs.values()) {
      Object.assign(execution.output!, output);
    }

    execution.status = 'completed';
    execution.endTime = Date.now();
    return execution;
  }

  /**
   * Validate workflow for circular dependencies
   */
  private validateWorkflow(workflow: WorkflowDefinition): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (stepId: string): boolean => {
      visited.add(stepId);
      recursionStack.add(stepId);

      const step = workflow.steps.find(s => s.id === stepId);
      if (step?.dependencies) {
        for (const dep of step.dependencies) {
          if (!visited.has(dep)) {
            if (dfs(dep)) return true;
          } else if (recursionStack.has(dep)) {
            throw new Error(`Circular dependency detected: ${stepId} -> ${dep}`);
          }
        }
      }

      recursionStack.delete(stepId);
      return false;
    };

    for (const step of workflow.steps) {
      if (!visited.has(step.id)) {
        dfs(step.id);
      }
    }
  }

  /**
   * Build adjacency list graph
   */
  private buildGraph(workflow: WorkflowDefinition): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    
    for (const step of workflow.steps) {
      graph.set(step.id, step.dependencies || []);
    }
    
    return graph;
  }

  /**
   * Prepare input for a step
   */
  private prepareInput(
    step: WorkflowStep, 
    initialInput: StepInput,
    previousOutputs: Map<string, StepOutput>
  ): StepInput {
    const input: StepInput = { ...initialInput };
    
    // Merge outputs from dependencies
    if (step.dependencies) {
      for (const depId of step.dependencies) {
        const depOutput = previousOutputs.get(depId);
        if (depOutput) {
          Object.assign(input, depOutput);
        }
      }
    }
    
    return input;
  }

  /**
   * Execute a single step
   */
  private async executeStep(step: WorkflowStep, input: StepInput): Promise<StepResult> {
    const result: StepResult = {
      stepId: step.id,
      status: 'running',
      startTime: Date.now()
    };

    const maxRetries = step.maxRetries || 0;
    let attempts = 0;

    while (attempts <= maxRetries) {
      try {
        const output = await step.action(input);
        result.output = output;
        result.status = 'completed';
        result.endTime = Date.now();
        return result;
      } catch (error) {
        attempts++;
        
        if (attempts > maxRetries || !step.retryable) {
          result.status = 'failed';
          result.error = (error as Error).message;
          result.endTime = Date.now();
          return result;
        }
        
        // Wait before retry
        await new Promise(r => setTimeout(r, 1000 * attempts));
      }
    }

    return result;
  }

  /**
   * Get workflow by ID
   */
  getWorkflow(id: string): WorkflowDefinition | undefined {
    return this.workflows.get(id);
  }

  /**
   * List all workflows
   */
  listWorkflows(): string[] {
    return Array.from(this.workflows.keys());
  }
}
