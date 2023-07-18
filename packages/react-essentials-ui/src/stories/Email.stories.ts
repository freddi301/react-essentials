import type { Meta, StoryObj } from "@storybook/react";
import { within, userEvent } from "@storybook/testing-library";

import { Email } from "./Email";

const meta: Meta<typeof Email> = {
  title: "Example/Email",
  component: Email,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
  argTypes: {
    theme: { control: "select", options: ["black", "white"] },
    background: { control: "boolean" },
    border: { control: "boolean" },
    weight: { control: "boolean" },
    color: { control: "boolean" },
  },
};
export default meta;
type Story = StoryObj<typeof Email>;

export const Read: Story = {
  args: {
    theme: "black",
    background: true,
    border: true,
    color: true,
    weight: true,
  },
  // More on interaction testing: https://storybook.js.org/docs/react/writing-tests/interaction-testing
  async play({ canvasElement }) {
    const canvas = within(canvasElement);
    const loginButton = await canvas.getByRole("button", {
      name: /Log in/i,
    });
    await userEvent.click(loginButton);
  },
};
