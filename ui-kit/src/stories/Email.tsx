/*
INSPIRATIONS:
https://minimals.cc/dashboard/mail
*/

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { library } from "@fortawesome/fontawesome-svg-core";
import { fas } from "@fortawesome/free-solid-svg-icons";

import "../components/theme.css";

library.add(fas);

export function Email({ theme }: { theme: "dark" | "light" }) {
  return (
    <div className={`theme ${theme}`}>
      <div
        className="secondary-background"
        style={{
          display: "flex",
          flexDirection: "row",
          width: "1200px",
          height: "600px",
          border: "2px dashed gray",
        }}
      >
        <div className="" style={{ width: "200px" }}>
          <table className="hoverable">
            <tbody>
              <tr className="secondary-text-color">
                <td>
                  <FontAwesomeIcon icon={"envelope"} />
                </td>
                <td style={{ width: "100%" }}>All</td>
                <td style={{ textAlign: "right" }}>23</td>
              </tr>
              <tr className="primary-text">
                <td>
                  <FontAwesomeIcon icon={"inbox"} />
                </td>
                <td style={{ width: "100%" }}>Inbox</td>
                <td style={{ textAlign: "right" }}>4</td>
              </tr>
              <tr className="secondary-text-color">
                <td>
                  <FontAwesomeIcon icon={"paper-plane"} />
                </td>
                <td style={{ width: "100%" }}>Sent</td>
                <td style={{ textAlign: "right" }}>2</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div
          className="primary-background card round margin-vertical border"
          style={{ width: "350px" }}
        >
          {emails.map(({ name, email, date, subject }, index) => {
            return (
              <div key={index} className="row border hoverable">
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <div>
                    {name} <span className="secondary-text-color">{email}</span>
                  </div>
                  <div>{dateFormatter.format(date)}</div>
                </div>
                <div>{subject}</div>
              </div>
            );
          })}
        </div>
        <div
          className="primary-background card margin round"
          style={{ flexGrow: 1 }}
        ></div>
      </div>
    </div>
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
    email: "jane.doe@emial.com",
    subject: "Paper House",
    date: new Date("2002-02-02"),
  },
];

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "short",
});
