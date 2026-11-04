export type AiTask = 'traffic_analysis'|'sign_recognition';
export type AiAnalysisDto = {
  task: AiTask;
  result: Record<string,unknown>;
  model:string;
  processedAt:string;
};
