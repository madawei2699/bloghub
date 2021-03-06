import Parser from 'rss-parser'
import { CreateArticleDto } from '../hub/dtos/create-article-dto';
import { FETCH_FEED_TIMEOUT } from '../../../settings';

export interface RssParseOutput {
  author?: string,
  articles: CreateArticleDto[],
}

export class RssParser {
  constructor(private readonly parser = new Parser({
    timeout: FETCH_FEED_TIMEOUT,
    customFields: {
      item: ['summary', 'category']
    }
  })) {
  }

  async fetch(feed: string): Promise<RssParseOutput> {
    console.log(`Start to fetch ${feed}`)
    const result = await this.parser.parseURL(feed)
    console.log(`Fetch ${feed} finish`)

    const articles = result.items
      // Filter too long url
      .filter(o => o.link.trim().length <= 255)
      .filter(o => o.title.trim().length <= 255)
      .map(o => new CreateArticleDto(
        feed,
        this.parseLink(feed, o.link),
        o.title.trim(),
        this.parseCategory(o),
        this.parseSummary(o),
        o.content?.trim() || '',
        this.fixDate(new Date(o.pubDate))
        )
      )
      .filter(o => !isNaN(o.date.getTime()))
    let author = null;
    if (result.items?.length) {
      author = result.items.map(o => o.creator).filter(o => o)[0] || null;
    }

    return {
      author,
      articles
    }
  }

  private parseCategory(article: Parser.Item): string[] {
    let categories = article.categories?.filter(t => typeof t === 'string') || []
    if (!categories.length && article.category?.$.term)
      categories = [article.category?.$.term]
    return categories
  }

  private parseLink(feed: string, link: string): string {
    link = link.trim()
    if (!link.startsWith('/')) return link

    return `${new URL(feed).origin}${link}`
  }

  private parseSummary(article: Parser.Item): string {
    return this.stripHtml(
      article.contentSnippet?.trim()
      || (typeof article.summary == 'string' ? article.summary.trim() : '')
    );
  }

  // Copy from https://github.com/rbren/rss-parser/blob/73dc39b9febcc51c0915d2c9851d390863a4a8e4/lib/utils.js#L5
  private stripHtml(str: string): string {
    return str
      .replace(/<(?:.|\n)*?>/gm, '')
      .replace(/\n/g, '');
  }

  private fixDate(date: Date): Date {
    const now = new Date();
    if (date <= now) {
      return date
    }

    // If date happens in future, subtract one day
    date.setTime(date.getTime() - 24 * 60 * 60 * 1000)
    return date
  }
}
