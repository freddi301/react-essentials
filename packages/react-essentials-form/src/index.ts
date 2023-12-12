import React from "react";

export type Field<Value> = ReturnType<typeof useField<Value>>;

type FieldState<Value> = (
  | { isSet: true; value: Value }
  | { isSet: false; value?: undefined }
) & {
  wasFocused: boolean;
  wasBlurred: boolean;
  hasFocus: boolean;
  hasChanged: boolean;
};

const initialFieldState: FieldState<any> = {
  isSet: false,
  wasFocused: false,
  wasBlurred: false,
  hasFocus: false,
  hasChanged: false,
};

export function useField<Value>({
  initialValue,
  isRequired = false,
  isEnabled = true,
  validate,
}: {
  initialValue?: Value;
  isEnabled?: boolean;
  isRequired?: boolean;
  validate?(value: Value): boolean;
}) {
  const [state, setState] =
    React.useState<FieldState<Value>>(initialFieldState);
  const value = state.isSet ? state.value : initialValue;
  const isValid = React.useMemo(() => {
    if (isRequired && !state.isSet) return false;
    if (validate && state.isSet && !validate(state.value)) return false;
    return true;
  }, [isRequired, state.isSet, state.value, validate]);
  const callbacks = React.useMemo(() => {
    return {
      setValue(value: Value) {
        setState((state) => {
          return { ...state, isSet: true, value, hasChanged: true };
        });
      },
      unsetValue() {
        setState((state) => {
          return { ...state, isSet: false, value: undefined };
        });
      },
      onFocus() {
        setState((state) => {
          return { ...state, wasFocused: true, hasFocus: true };
        });
      },
      onBlur() {
        setState((state) => {
          return { ...state, wasBlurred: true, hasFocus: false };
        });
      },
    };
  }, []);
  return {
    ...state,
    initialValue,
    value,
    isValid,
    isRequired,
    isEnabled,
    setState,
    ...callbacks,
  };
}

export function fieldProps(fields: Array<Field<any>>) {
  const hasChanged = fields.some((field) => field.hasChanged);
  const isValid = fields.every((field) => field.isValid);
  const reset = () => {
    fields.forEach((field) => field.setState(initialFieldState));
  };
  return { hasChanged, isValid, reset };
}

export function shouldShowError<Value>(
  field: ReturnType<typeof useField<Value>>
) {
  return (
    field.isEnabled &&
    field.wasFocused &&
    field.wasBlurred &&
    !field.hasFocus &&
    !field.isValid
  );
}
