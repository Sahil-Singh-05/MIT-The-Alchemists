import { useState } from 'react';
import { motion } from 'framer-motion';

const ticketRows = [
  {
    id: 'TKT-2847',
    subject: 'Acme Corp',
    updated: '2 days ago',
    createdBy: 'Sahil',
    employeeId: 'EY-100',
    chatSummary:
      'The employee asked for clarification around reimbursement workflow, policy access, and ticket ownership after a payroll adjustment request.',
    queries: [
      {
        question: 'Who is responsible for approving the payroll adjustment request?',
        answer: 'Payroll operations owns the approval flow, while HR validates the supporting policy documents before the change is finalized.',
      },
      {
        question: 'Where can the employee find the latest policy copy?',
        answer: 'The latest policy is available in the uploads dashboard under the compensation and payroll documentation folder.',
      },
    ],
  },
  {
    id: 'TKT-2843',
    subject: 'Leave policy for remote employees',
    updated: '5 min ago',
    createdBy: 'Sahil',
    employeeId: 'EY-100',
    chatSummary:
      'The employee wants a clear explanation of leave eligibility, approval timelines, and whether remote team members follow the same handbook as office staff.',
    queries: [
      {
        question: 'Do remote employees follow the same leave policy as office employees?',
        answer: 'Yes. Remote employees follow the same leave entitlement and approval flow unless a country-specific addendum applies.',
      },
      {
        question: 'How early should leave be requested?',
        answer: 'Planned leave should be submitted at least three working days in advance so the manager and HR team can review coverage.',
      },
    ],
  },
  {
    id: 'TKT-2838',
    subject: 'Acme Corp',
    updated: '1 week ago',
    createdBy: 'Sahil',
    employeeId: 'EY-100',
    chatSummary:
      'This thread covers document verification, missing approval history, and a request for confirmation before an offer update is sent out.',
    queries: [
      {
        question: 'Has the approval history been attached to the case?',
        answer: 'The approval history was requested from operations and is expected to be attached before the final response is shared.',
      },
    ],
  },
  {
    id: 'TKT-2819',
    subject: 'Acme Corp',
    updated: '1 month ago',
    createdBy: 'Sahil',
    employeeId: 'EY-100',
    chatSummary:
      'The employee requested a resolution timeline and confirmation that all historical responses will remain visible after the case is reopened.',
    queries: [
      {
        question: 'Will previous comments remain visible after reopening?',
        answer: 'Yes. Reopening the ticket preserves the full thread so historical responses remain available for audit and follow-up.',
      },
    ],
  },
];

function TicketRow({ ticket, onSelect }) {
  return (
    <div
      className="tickets-row"
      onClick={() => onSelect(ticket)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(ticket);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="tickets-mobile-label">Ticket ID</div>
      <div className="tickets-row-id">{ticket.id}</div>

      <div className="tickets-mobile-label">Subject</div>
      <div className="tickets-row-subject">{ticket.subject}</div>

      <div className="tickets-mobile-label">Updated</div>
      <div className="tickets-row-updated">{ticket.updated}</div>
    </div>
  );
}

function TicketDetail({ ticket, onBack }) {
  return (
    <motion.section
      className="tickets-page"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
    >
      <div className="tickets-shell">
        <button type="button" className="tickets-back-button" onClick={onBack}>
          <span className="tickets-back-arrow" aria-hidden="true">←</span>
          <span>Back to Tickets</span>
        </button>

        <div className="tickets-detail-card">
          <div className="tickets-detail-scroll">
            <div className="tickets-detail-row">
              <div className="tickets-detail-label">Ticket ID</div>
              <div className="tickets-detail-value tickets-detail-id">{ticket.id}</div>
            </div>

            <div className="tickets-detail-row">
              <div className="tickets-detail-label">Subject</div>
              <div className="tickets-detail-value">{ticket.subject}</div>
            </div>

            <div className="tickets-detail-row">
              <div className="tickets-detail-label">Created By</div>
              <div className="tickets-detail-value">{ticket.createdBy}</div>
            </div>

            <div className="tickets-detail-row">
              <div className="tickets-detail-label">Employee ID</div>
              <div className="tickets-detail-value">{ticket.employeeId}</div>
            </div>

            <div className="tickets-detail-row">
              <div className="tickets-detail-label">Updated</div>
              <div className="tickets-detail-value">{ticket.updated}</div>
            </div>

            <div className="tickets-detail-row tickets-detail-block">
              <div className="tickets-detail-label">Chat Summary</div>
              <div className="tickets-detail-copy">{ticket.chatSummary}</div>
            </div>

            <div className="tickets-detail-section">
              <div className="tickets-detail-section-title">Queries</div>

              <div className="tickets-query-list">
                {ticket.queries.map((query, index) => (
                  <div key={`${ticket.id}-query-${index}`} className="tickets-query-item">
                    <div className="tickets-query-question">Q. {query.question}</div>
                    <div className="tickets-query-answer-wrap">
                      <span className="tickets-query-arrow">&gt;</span>
                      <div className="tickets-query-answer">{query.answer}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

export default function Tickets() {
  const [selectedTicket, setSelectedTicket] = useState(null);

  if (selectedTicket) {
    return <TicketDetail ticket={selectedTicket} onBack={() => setSelectedTicket(null)} />;
  }

  return (
    <section className="tickets-page">
      <div className="tickets-shell">
        <h1 className="tickets-title">Tickets</h1>

        <div className="tickets-table">
          <div className="tickets-card tickets-card-header">
            <div className="tickets-grid tickets-grid-header">
              <div className="tickets-heading">Ticket ID</div>
              <div className="tickets-heading">Subject</div>
              <div className="tickets-heading tickets-heading-right">Updated</div>
            </div>
          </div>

          <div className="tickets-card tickets-card-body">
            {ticketRows.map((ticket) => (
              <TicketRow
                key={ticket.id}
                ticket={ticket}
                onSelect={setSelectedTicket}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
