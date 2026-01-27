"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Theme, Recommendation, RecommendationPriority } from "@/lib/types";
import { Loader2 } from "lucide-react";

export interface NewTask {
  title: string;
  description: string;
  themeId: string | null;
  recommendationId: string | null;
  priority: RecommendationPriority;
  assignee: string;
  dueDate: string;
}

interface AddTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (task: NewTask) => void;
  themes: Theme[];
  recommendations: Recommendation[];
  assignees: string[];
}

export function AddTaskModal({
  open,
  onOpenChange,
  onSubmit,
  themes,
  recommendations,
  assignees,
}: AddTaskModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<NewTask>({
    title: "",
    description: "",
    themeId: null,
    recommendationId: null,
    priority: "medium",
    assignee: "",
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    onSubmit(formData);
    setIsSubmitting(false);
    
    // Reset form
    setFormData({
      title: "",
      description: "",
      themeId: null,
      recommendationId: null,
      priority: "medium",
      assignee: "",
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add New Task</DialogTitle>
            <DialogDescription>
              Create a new task to track an action item. Link it to a theme or
              recommendation for impact tracking.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Title */}
            <div className="grid gap-2">
              <Label htmlFor="title">
                Title <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="title"
                placeholder="e.g., Train staff on customer service best practices"
                value={formData.title}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, title: e.target.value }))
                }
                required
              />
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Add more details about this task..."
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                rows={3}
              />
            </div>

            {/* Theme */}
            <div className="grid gap-2">
              <Label htmlFor="theme">Link to Theme (optional)</Label>
              <Select
                value={formData.themeId || "none"}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    themeId: value === "none" ? null : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No theme</SelectItem>
                  {themes.map((theme) => (
                    <SelectItem key={theme.id} value={theme.id}>
                      {theme.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Recommendation */}
            <div className="grid gap-2">
              <Label htmlFor="recommendation">
                Link to Recommendation (optional)
              </Label>
              <Select
                value={formData.recommendationId || "none"}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    recommendationId: value === "none" ? null : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a recommendation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No recommendation</SelectItem>
                  {recommendations.map((rec) => (
                    <SelectItem key={rec.id} value={rec.id}>
                      {rec.title.length > 50
                        ? rec.title.substring(0, 50) + "..."
                        : rec.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority and Due Date row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      priority: value as RecommendationPriority,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, dueDate: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Assignee */}
            <div className="grid gap-2">
              <Label htmlFor="assignee">Assign To</Label>
              <Select
                value={formData.assignee || "none"}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    assignee: value === "none" ? "" : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select assignee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {assignees.map((assignee) => (
                    <SelectItem key={assignee} value={assignee}>
                      {assignee}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !formData.title.trim()}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Task"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
