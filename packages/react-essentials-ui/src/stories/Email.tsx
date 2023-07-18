/*
INSPIRATIONS:
https://minimals.cc/dashboard/mail
https://outlook.office.com
*/

// TODO: collapsible items in the left bar
// TODO: selectable items (middlebar) -> add more actions if selected (add also write)
// TODO: more stuff from https://outlook.office.com

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { library } from "@fortawesome/fontawesome-svg-core";
import { fas } from "@fortawesome/free-solid-svg-icons";

import "../components/theme.css";
import React from "react";

library.add(fas);

export function Email({
  theme,
  background,
  border,
  weight,
  color,
}: {
  theme: "black" | "white";
  background: boolean;
  border: boolean;
  weight: boolean;
  color: boolean;
}) {
  return (
    <div className={`ds-theme ds-theme-${theme} ds-theme-defaults`}>
      <div
        className={`${
          background ? "ds-background-secondary" : ""
        } ds-padding ds-gap`}
        style={{
          width: "1200px",
          height: "800px",
          border: "2px dashed gray",
          display: "grid",
          gridTemplateColumns: "200px 400px 1fr",
          gridTemplateRows: "auto auto 1fr auto",
        }}
      >
        <div
          style={{ gridRow: "1", gridColumn: "1 / span 3", display: "flex" }}
          className={`${background ? "ds-background-primary" : ""} ${
            border ? "ds-border" : ""
          } ds-padding ds-border-round ds-gap`}
        >
          <div style={{ alignSelf: "center" }}>
            <FontAwesomeIcon icon={"envelope"} size="2x" />
          </div>
          <div style={{ flexGrow: 1 }}>
            <div className={`${weight ? "ds-font-weight-bold" : ""}`}>
              Me Myself
            </div>
            <div className={`${color ? "ds-font-color-secondary" : ""}`}>
              mr.myself@email.com
            </div>
          </div>
          <div>
            <Input label="Search" />
          </div>
        </div>
        <div
          style={{
            gridRow: "2",
            gridColumn: "2 / span 2",
            display: "flex",
            overflow: "auto",
          }}
          className={``}
        >
          <Tab
            icon={<FontAwesomeIcon icon={"inbox"} />}
            label="Main"
            isActive
          />
          <Tab icon={<FontAwesomeIcon icon={"people-group"} />} label="Forum" />
          <Tab
            icon={<FontAwesomeIcon icon={"newspaper"} />}
            label="Subscriptions"
          />
          <div style={{ flexGrow: 1 }} />
          <Button
            icon={<FontAwesomeIcon icon={"plus"} />}
            label="New category"
          />
        </div>
        <div
          className={`ds-border-round ${
            background ? "ds-background-primary" : ""
          } ${border ? "ds-border" : ""}`}
          style={{ gridRow: "2 / span 2", gridColumn: "1" }}
        >
          <Button icon={<FontAwesomeIcon icon={"pen"} />} label="Write" />

          <div
            className="ds-hoverable ds-gap ds-padding"
            style={{
              display: "flex",
            }}
          >
            <div style={{}}>
              <FontAwesomeIcon icon={"envelope"} />
            </div>
            <div style={{ flexGrow: 1 }}>All</div>
            <div
              style={{}}
              className={`${background ? "ds-badge" : ""} ds-border-round`}
            >
              23
            </div>
          </div>
          <div
            className="ds-background-active ds-hoverable ds-gap ds-padding"
            style={{
              display: "flex",
            }}
          >
            <div style={{}}>
              <FontAwesomeIcon icon={"inbox"} />
            </div>
            <div style={{ flexGrow: 1 }}>Inbox</div>
            <div
              style={{}}
              className={`${background ? "ds-badge" : ""} ds-border-round`}
            >
              4
            </div>
          </div>
          <div
            className="ds-hoverable ds-gap ds-padding"
            style={{
              display: "flex",
            }}
          >
            <div style={{}}>
              <FontAwesomeIcon icon={"paper-plane"} />
            </div>
            <div style={{ flexGrow: 1 }}>Sent</div>
            <div
              style={{}}
              className={`${background ? "ds-badge" : ""} ds-border-round`}
            >
              2
            </div>
          </div>
          <div
            className="ds-hoverable ds-gap ds-padding ds-background-disabled ds-font-color-disabled"
            style={{
              display: "flex",
            }}
          >
            <div style={{}}>
              <FontAwesomeIcon icon={"archive"} />
            </div>
            <div style={{ flexGrow: 1 }}>Archived</div>
            <div
              style={{}}
              className={`${background ? "ds-badge" : ""} ds-border-round`}
            >
              22
            </div>
          </div>
        </div>
        <div
          className={`ds-border-round ${
            background ? "ds-background-primary" : ""
          } ${border ? "ds-border" : ""}`}
          style={{ gridRow: "3", gridColumn: "2" }}
        >
          {emails.map(({ name, email, date, subject }, index) => {
            return (
              <div
                key={index}
                className={`ds-padding ds-hoverable ${
                  border ? "ds-border-bottom" : ""
                } ${index === 2 ? "ds-background-hover" : ""}`}
              >
                <div className="ds-gap" style={{ display: "flex" }}>
                  <div className={`${weight ? "ds-font-weight-bold" : ""}`}>
                    {name}
                  </div>
                  <div
                    className={`${color ? "ds-font-color-secondary" : ""}`}
                    style={{ flexGrow: 1 }}
                  >
                    {email}
                  </div>
                  <div>{dateFormatter.format(date)}</div>
                </div>
                <div>{subject}</div>
              </div>
            );
          })}
        </div>
        <div
          className={`ds-border-round ${
            background ? "ds-background-primary" : ""
          } ${border ? "ds-border" : ""}`}
          style={{ gridRow: "3", gridColumn: "3", overflow: "auto" }}
        >
          <div
            style={{ display: "flex" }}
            className={`${border ? "ds-border-bottom" : ""}`}
          >
            <Button icon={<FontAwesomeIcon icon={"reply"} />} label={"Reply"} />
            <Button
              icon={<FontAwesomeIcon icon={"reply-all"} />}
              label={"Reply All"}
            />
            <Button
              disabled
              icon={<FontAwesomeIcon icon={"forward"} />}
              label={"Forward"}
            />
            <div style={{ flexGrow: 1 }} />
            <Button
              icon={<FontAwesomeIcon icon={"archive"} />}
              label={"Archive"}
            />
            <Button
              icon={<FontAwesomeIcon icon={"trash"} />}
              label={"Delete"}
            />
          </div>
          <div
            style={{ display: "flex" }}
            className={`ds-padding ${border ? "ds-border-bottom" : ""}`}
          >
            <div
              className={`${weight ? "ds-font-weight-bold" : ""}`}
              style={{ flexGrow: 1 }}
            >
              Re: My House
            </div>
            <div className={`${color ? "ds-font-color-secondary" : ""}`}>
              {dateFormatter.format(new Date())}
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gridTemplateRows: "auto auto auto",
            }}
            className={`ds-padding ${border ? "ds-border-bottom" : ""} ds-gap`}
          >
            {["From", "To", "CC"].map((label, index) => {
              return (
                <React.Fragment key={label}>
                  <div
                    style={{
                      gridRow: index + 1,
                      gridColumn: "1",
                      textAlign: "right",
                    }}
                  >
                    {label}:
                  </div>
                  <div
                    style={{
                      gridRow: index + 1,
                      gridColumn: "2",
                    }}
                  >
                    {emails.map(({ name, email }, index) => {
                      return (
                        <div
                          key={index}
                          style={{ display: "flex" }}
                          className={`ds-gap`}
                        >
                          <div
                            className={`${weight ? "ds-font-weight-bold" : ""}`}
                          >
                            {name}
                          </div>
                          <div
                            className={`${
                              color ? "ds-font-color-secondary" : ""
                            }`}
                          >
                            {email}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
          <div className="ds-padding">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc
            venenatis eleifend ligula sit amet lacinia. Donec nec enim eget
            dolor tempor pellentesque. Etiam vehicula efficitur blandit. Mauris
            ut elit vitae erat finibus mollis in eu ligula. Morbi condimentum
            diam vel semper mattis. Aliquam varius nulla eget gravida
            sollicitudin. Phasellus blandit dapibus orci, quis hendrerit libero
            sagittis eget. Maecenas at lobortis diam, ut mollis dui. Duis in
            ultricies ligula. Vivamus dictum id lectus in pharetra. Nulla
            convallis mollis rutrum. Mauris viverra elit non rhoncus posuere.
            Nunc sapien urna, convallis ac molestie ac, lobortis nec elit.
          </div>
        </div>
        <div
          style={{ gridRow: "4", gridColumn: "1 / span 3" }}
          className={`${background ? "ds-background-primary" : ""} ${
            border ? "ds-border" : ""
          } ds-border-round ds-padding`}
        >
          Total space occupied: 1.5GB
        </div>
      </div>
    </div>
  );
}

function Button({
  icon,
  label,
  disabled = false,
}: {
  icon?: React.ReactNode;
  label: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button className="ds-button" disabled={disabled}>
      {icon && <React.Fragment>{icon}&nbsp;&nbsp;</React.Fragment>}
      {label}
    </button>
  );
}

function Input({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <label>Search</label>
      <input className="ds-input" />
    </div>
  );
}

function Tab({
  icon,
  label,
  isActive,
}: {
  icon?: React.ReactNode;
  label: React.ReactNode;
  isActive?: boolean;
}) {
  return (
    <a
      href="/"
      className={`ds-link ds-tab ${isActive ? "ds-background-active" : ""}`}
    >
      {icon && <React.Fragment>{icon}&nbsp;&nbsp;</React.Fragment>}
      {label}
    </a>
  );
}

const emails: Array<{
  name: string;
  email: string;
  subject: string;
  date: Date;
}> = [
  {
    name: "John Doe",
    email: "john.doe@email.com",
    subject: "Brick House",
    date: new Date("2000-01-01"),
  },
  {
    name: "Jane Doe",
    email: "jane.doe@email.com",
    subject: "Paper House",
    date: new Date("2002-02-02"),
  },
  {
    name: "Mary White",
    email: "mary.white@email.com",
    subject: "Sand House",
    date: new Date("2003-03-03"),
  },
];

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "short",
});
