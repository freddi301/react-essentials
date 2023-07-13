import React from "react";
import { Field, fieldProps, useField } from "./form";

function MyForm() {
  const name = useField<string>({ initialValue: "John Doe" });
  const age = useField<number>({
    isRequired: true,
    validate: (value) => value >= 18,
  });
  const fields = fieldProps([name, age]);
  const formData = React.useMemo(() => {
    if (!fields.isValid) return;
    if (!age.value) return;
    return { name: name.value, age: age.value };
  }, []);
  const client = { mutate(data: { name?: string; age: number }): void {} };
  const submitMutation = { pending: [] };
  const canSubmit = Boolean(formData) && submitMutation.pending.length === 0;
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit && formData) {
          client.mutate(formData);
        }
      }}
    >
      <TextInput {...name} label="Name" />
      <button disabled={!canSubmit}>Submit</button>
    </form>
  );
}

function TextInput(props: Field<string> & { label: string }) {
  const id = `${React.useId()}-name`;
  return (
    <div>
      <label htmlFor={id}>{props.label}</label>
      <input
        id={id}
        value={props.value ?? ""}
        onChange={(event) => {
          props.setValue(event.target.value);
        }}
      />
    </div>
  );
}

test.todo("nothing");
