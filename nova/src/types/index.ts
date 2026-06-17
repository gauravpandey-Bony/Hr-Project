export type QuestionType = "text" | "textarea" | "rating" | "select" | "multiselect";

export interface FormQuestion {
  id: string;
  type: QuestionType;
  label: string;
  required?: boolean;
  options?: string[];
}

export interface FormSection {
  id: string;
  title: string;
  questions: FormQuestion[];
}

export interface ReviewFormSchema {
  sections: FormSection[];
}

export interface RatingScale {
  type: "numeric" | "likert" | "text";
  min?: number;
  max?: number;
  labels?: string[];
}

export interface ReviewWorkflow {
  self: boolean;
  manager: boolean;
  peer: boolean;
  peerCount?: number;
}

export interface DashboardStats {
  activeCycles: number;
  pendingReviews: number;
  completionRate: number;
  openFeedback: number;
  goalsOnTrack: number;
  surveyParticipation: number;
}
