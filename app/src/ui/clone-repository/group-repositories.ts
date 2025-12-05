import { IAPIRepository } from '../../lib/api'
import { IFilterListGroup, IFilterListItem } from '../lib/filter-list'
import { OcticonSymbol } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import entries from 'lodash/entries'
import groupBy from 'lodash/groupBy'
import { caseInsensitiveEquals, compare } from '../../lib/compare'

/** The identifier for the "Your Repositories" grouping. */
export const YourRepositoriesIdentifier = 'your-repositories'

export interface ICloneableRepositoryListItem extends IFilterListItem {
  /** The identifier for the item. */
  readonly id: string

  /** The search text. */
  readonly text: ReadonlyArray<string>

  /** The name of the repository. */
  readonly name: string

  /** The icon for the repo. */
  readonly icon: OcticonSymbol

  /** The clone URL. */
  readonly url: string

  /** Whether or not the repository is archived */
  readonly archived?: boolean

  /** Whether or not the repository is cloned locally */
  readonly isCloned?: boolean

  /** The local path of the repository if cloned */
  readonly localPath?: string
}

function getIcon(gitHubRepo: IAPIRepository): OcticonSymbol {
  if (gitHubRepo.private) {
    return octicons.lock
  }
  if (gitHubRepo.fork) {
    return octicons.repoForked
  }

  return octicons.repo
}

/** Info about a local repository for matching against API repos */
export interface ILocalRepoInfo {
  /** The full name (owner/repo) of the GitHub repository */
  readonly fullName: string
  /** The local path of the repository */
  readonly path: string
}

const toListItems = (
  repositories: ReadonlyArray<IAPIRepository>,
  localRepos?: ReadonlyArray<ILocalRepoInfo>
) => {
  // Build a map for quick lookup of local repos by fullName
  const localRepoMap = new Map<string, string>()
  if (localRepos) {
    for (const local of localRepos) {
      localRepoMap.set(local.fullName.toLowerCase(), local.path)
    }
  }

  return repositories
    .map<ICloneableRepositoryListItem>(repo => {
      const fullName = `${repo.owner.login}/${repo.name}`.toLowerCase()
      const localPath = localRepoMap.get(fullName)
      return {
        id: repo.html_url,
        text: [`${repo.owner.login}/${repo.name}`],
        url: repo.clone_url,
        name: repo.name,
        icon: getIcon(repo),
        archived: repo.archived,
        isCloned: localPath !== undefined,
        localPath,
      }
    })
    .sort((x, y) => compare(x.name, y.name))
}

export function groupRepositories(
  repositories: ReadonlyArray<IAPIRepository>,
  login: string,
  localRepos?: ReadonlyArray<ILocalRepoInfo>
): ReadonlyArray<IFilterListGroup<ICloneableRepositoryListItem>> {
  const groups = groupBy(repositories, x =>
    caseInsensitiveEquals(x.owner.login, login)
      ? YourRepositoriesIdentifier
      : x.owner.login
  )

  return entries(groups)
    .map(([identifier, repos]) => ({
      identifier,
      items: toListItems(repos, localRepos),
    }))
    .sort((x, y) => {
      if (x.identifier === YourRepositoriesIdentifier) {
        return -1
      } else if (y.identifier === YourRepositoriesIdentifier) {
        return 1
      } else {
        return compare(x.identifier, y.identifier)
      }
    })
}
