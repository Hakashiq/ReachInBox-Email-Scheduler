import { Client } from '@elastic/elasticsearch';

const ES_NODE = process.env.ELASTICSEARCH_NODE || 'http://localhost:9200';

export const esClient = new Client({
  node: ES_NODE,
});

const INDEX_NAME = 'emails_index';

// Initialize Index Mappings on Startup
export async function initializeElasticsearch() {
  try {
    const ping = await esClient.ping();
    if (!ping) {
      console.warn('[Elasticsearch] Warning: Ping failed.');
      return;
    }
    console.log('[Elasticsearch] Connected to node:', ES_NODE);

    const result = await esClient.indices.exists({ index: INDEX_NAME });
    let indexExists = false;
    if (typeof result === 'boolean') {
      indexExists = result;
    } else if (result && typeof (result as any).body === 'boolean') {
      indexExists = (result as any).body;
    } else if (result && (result as any).statusCode === 200) {
      indexExists = true;
    }

    if (!indexExists) {
      console.log(`[Elasticsearch] Creating index "${INDEX_NAME}" with custom mappings...`);
      await esClient.indices.create({
        index: INDEX_NAME,
        mappings: {
          properties: {
            email_id: { type: 'keyword' },
            campaign_id: { type: 'keyword' },
            user_id: { type: 'keyword' },
            recipient: { type: 'text' },
            subject: { type: 'text' },
            body: { type: 'text' },
            sender: { type: 'keyword' },
            status: { type: 'keyword' },
            scheduled_time: { type: 'date' },
            sent_time: { type: 'date' },
          },
        },
      });
      console.log(`[Elasticsearch] Index "${INDEX_NAME}" created successfully.`);
    } else {
      console.log(`[Elasticsearch] Index "${INDEX_NAME}" already exists.`);
    }
  } catch (err) {
    console.error('[Elasticsearch] Connection or Initialization error:', err);
  }
}

interface IndexEmailParams {
  emailId: string;
  campaignId: string;
  userId: string;
  recipient: string;
  subject: string;
  body: string;
  sender: string;
  status: string;
  scheduledTime: string;
  sentTime?: string | null;
  retryCount?: number;
}

// Index or Update Email logs in ES
export async function indexEmail(data: IndexEmailParams) {
  try {
    await esClient.index({
      index: INDEX_NAME,
      id: data.emailId, // Use database email ID as document ID for idempotency
      document: {
        email_id: data.emailId,
        campaign_id: data.campaignId,
        user_id: data.userId,
        recipient: data.recipient,
        subject: data.subject,
        body: data.body,
        sender: data.sender,
        status: data.status,
        scheduled_time: new Date(data.scheduledTime).toISOString(),
        sent_time: data.sentTime ? new Date(data.sentTime).toISOString() : null,
        retry_count: data.retryCount || 0,
      },
      refresh: true, // Force immediate searchability (critical for real-time validation & tests)
    });
    console.log(`[Elasticsearch] Indexed email document: ${data.emailId}`);
  } catch (err) {
    console.error(`[Elasticsearch] Failed to index email ${data.emailId}:`, err);
  }
}

// Search user's emails
export async function searchEmails(userId: string, searchPhrase: string) {
  try {
    const result = await esClient.search({
      index: INDEX_NAME,
      query: {
        bool: {
          must: [
            { term: { user_id: userId } }, // Restrict search to this user's emails
            {
              multi_match: {
                query: searchPhrase,
                fields: ['recipient', 'subject', 'body', 'sender'],
                fuzziness: 'AUTO',
              },
            },
          ],
        },
      },
    });

    const hits = (result as any).body?.hits?.hits || (result as any).hits?.hits || [];
    return hits.map((hit: any) => hit._source);
  } catch (err) {
    console.error(`[Elasticsearch] Search query error for user ${userId}:`, err);
    return [];
  }
}
