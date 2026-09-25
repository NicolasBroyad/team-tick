"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { createProject } from "@/app/actions/projects";
import { Button, Input, Label, Modal, Textarea } from "@/components/ui";

export function NewProjectButton() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createProject, undefined);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Nuevo proyecto
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nuevo proyecto"
        description="Después vas a poder crear listas y sumar integrantes con un link."
      >
        <form action={action} className="space-y-4">
          <div>
            <Label htmlFor="project-name">Nombre</Label>
            <Input
              id="project-name"
              name="name"
              required
              maxLength={100}
              autoFocus
              placeholder="Ej.: Lanzamiento de la web"
            />
          </div>
          <div>
            <Label htmlFor="project-description">Descripción (opcional)</Label>
            <Textarea
              id="project-description"
              name="description"
              rows={3}
              maxLength={500}
              placeholder="¿De qué se trata?"
            />
          </div>
          {state?.error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {state.error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Crear proyecto
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
