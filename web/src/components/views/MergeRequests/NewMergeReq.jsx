import React, { Component } from 'react';
import { connect } from 'react-redux';
import {
  shape, number, string, arrayOf, func,
} from 'prop-types';
import { Redirect, Link } from 'react-router-dom';
import { toastr } from 'react-redux-toastr';
import MergeRequestEdit from 'components/layout/MergeRequests/MergeRequestEdit';
import MBranchSelector from 'components/ui/MBranchSelector';
import { generateBreadCrumbs } from 'functions/helpers';
import actions from './mergeReqActions';
import ProjectContainer from '../../projectContainer';
import Navbar from '../../navbar/navbar';
import './newMergeRequest.css';
import BranchesApi from '../../../apis/BranchesApi.ts';
import ImageDiffSection from '../../imageDiffSection/imageDiffSection';
import CommitsList from '../../commitsList';
import { getFileDifferences } from '../../../functions/apiCalls';

const imageFormats = [
  '.png',
  '.jpg',
];

const brApi = new BranchesApi();

const getBranchFromSearch = (search) => {
  const decoded = decodeURIComponent(search.substr(1));
  const pairs = decoded.split('&').map((str) => str.split('='));
  const [, val] = pairs.find(([key, val]) => key === 'merge_request[source_branch]');

  return val;
};

export class NewMergeRequest extends Component {
  constructor() {
    super();
    this.state = {
      commits: [],
      lastCommit: {},
      imagesToRender: [],
      title: '',
      description: '',
      branch: '',
      branchToMergeInto: '',
      redirect: false,
    };
    this.onBranchChanged = this.onBranchChanged.bind(this);
    this.onTitleChange = this.onTitleChange.bind(this);
    this.onDescriptionChange = this.onDescriptionChange.bind(this);
    this.handleCreateBranchEv = this.handleCreateBranchEv.bind(this);
  }

  componentDidMount() {
    const {
      projects: {
        selectedProject: { defaultBranch },
      },
      location: { search },
    } = this.props;

    const branch = search ? getBranchFromSearch(search) : defaultBranch;

    this.setState({ branch });
  }

  onBranchChanged(branchSelected) {
    this.setState({ branchToMergeInto: branchSelected });
    const {
      projects: {
        selectedProject,
      },
    } = this.props;

    const { branch } = this.state;

    brApi.compare(selectedProject.gid, branchSelected, branch)
      .then((res) => {
        this.setState({
          lastCommit: res.commit,
          commits: res.commits,
          diffs: res.diffs,
        });
        this.getDiffDetails(res.diffs);
      }).catch((err) => {
        toastr.error('Error', err.message);
      });
  }

  onTitleChange(e) {
    this.setState({
      title: e.target.value,
    });
  }

  onDescriptionChange(e) {
    this.setState({
      description: e.target.value,
    });
  }

  getDiffDetails(diffsArray) {
    const { lastCommit } = this.state;
    const {
      projects: {
        selectedProject: { gid },
      },
    } = this.props;
    diffsArray.filter((diff) => imageFormats
      .filter((format) => diff.old_path.includes(format))
      .length > 0)
      .forEach(async (imageDiff) => {
        const { imagesToRender } = this.state;
        const {
          previousVersionFile,
          nextVersionFile,
          imageFileSize,
        } = await getFileDifferences(gid, imageDiff, lastCommit.parent_ids[0], lastCommit.id);
        imagesToRender.push({
          previousVersionFileParsed: previousVersionFile,
          nextVersionFileParsed: nextVersionFile,
          imageFileSize,
          fileName: imageDiff.old_path.split('/').slice(-1)[0],
        });
        this.setState({ ...imagesToRender });
      });
  }

  handleCancel = () => {
    const {
      history,
    } = this.props;

    return history.goBack();
  };

  handleCreateBranchEv() {
    const {
      title,
      description,
      branchToMergeInto,
      branch,
    } = this.state;
    const {
      projects: {
        selectedProject: { gid },
      },
    } = this.props;

    actions.submit(gid, branch, branchToMergeInto, title, description)
      .then(() => {
        this.setState({ redirect: true });
      }).catch((err) => {
        toastr.error('Error: ', err.message);
      });
  }

  render() {
    const {
      title,
      branchToMergeInto,
      commits,
      diffs,
      imagesToRender,
      // loading,
      redirect,
      branch,
      description,
    } = this.state;
    const isEnabledCreateMergeReq = title.length > 0
        && branchToMergeInto.length > 0;
    const {
      projects: {
        selectedProject,
      },
      branches,
      users,
      match: {
        params: {
          namespace,
          slug,
        },
      },
    } = this.props;

    const customCrumbs = [
      {
        name: 'Data',
        href: `/${namespace}/${slug}`,
      },
      {
        name: 'Merge Requests',
        href: `/${namespace}/${slug}/-/merge_requests`,
      },
      {
        name: 'New',
      },
    ];

    return (
      <>
        {redirect && (
          <Redirect to={`/${namespace}/${slug}`} />
        )}
        <Navbar />
        <ProjectContainer
          activeFeature="data"
          breadcrumbs={generateBreadCrumbs(selectedProject, customCrumbs)}
        />
        <div className="main-content">
          <br />
          <p style={{ color: '#1A2B3F', fontSize: '1em' }}>
            <b>New Merge request</b>
          </p>
          <br />
          <div style={{
            display: 'flex',
            alignItems: 'center',
            height: 'max-content',
          }}
          >
            <p id="branch-selected-name" variant="h6" component="h5" style={{ color: '#1A2B3F', fontSize: '1.1em' }}>
              from&nbsp;
              <Link to={`/${namespace}/${slug}/-/tree/${branch}`}>
                <b>{decodeURIComponent(branch)}</b>
              </Link>
              &nbsp;into
            </p>
            <div className="ml-3 my-auto flex-1">
              <MBranchSelector
                className="new-merge-request-select-box"
                branches={branches}
                onBranchSelected={this.onBranchChanged}
                activeBranch={branchToMergeInto || 'Select a branch...'}
                showDatasets
                showExperiments
                showVisualizations
              />
            </div>
          </div>
          <br />
          <br />
          <div style={{ borderTop: '1px solid #e5e5e5' }}>
            <MergeRequestEdit
              title={title}
              description={description}
              onTitleChange={this.onTitleChange}
              onDescriptionChange={this.onDescriptionChange}
            />
          </div>
          <div style={{
            display: 'flex',
            backgroundColor: '#F9F8F8',
            padding: '1em 2em',
            justifyContent: 'space-between',
          }}
          >
            <button
              id="cancel-button"
              type="button"
              className="btn btn-basic-dark"
              onClick={this.handleCancel}
            >
              Cancel
            </button>

            <button
              id="submit-merge-request"
              type="button"
              className="btn btn-primary"
              onClick={this.handleCreateBranchEv}
              disabled={!isEnabledCreateMergeReq}
            >
              Submit merge request
            </button>
          </div>
          <br />
          {commits.length > 0 && (
            <CommitsList
              commits={commits}
              users={users}
              projectId={selectedProject.gid}
              changesNumber={diffs.length}
            />
          )}
          {imagesToRender.map((imageFile) => (
            <ImageDiffSection
              key={imageFile.fileName}
              fileInfo={imageFile}
              fileSize={imageFile.imageFileSize}
              original={imageFile.previousVersionFileParsed}
              modified={imageFile.nextVersionFileParsed}
            />
          ))}
        </div>
      </>
    );
  }
}

NewMergeRequest.propTypes = {
  projects: shape({
    selectedProject: shape({
      gid: number.isRequired,
    }).isRequired,
  }).isRequired,
  location: shape({
    search: string.isRequired,
  }).isRequired,
  match: shape({
    params: shape({
      namespace: string.isRequired,
      slug: string.isRequired,
    }),
  }).isRequired,
  branches: arrayOf(shape).isRequired,
  users: arrayOf(
    shape({
      name: string.isRequired,
    }).isRequired,
  ).isRequired,
  history: shape({
    goBack: func.isRequired,
  }).isRequired,
};

function mapStateToProps(state) {
  return {
    users: state.users,
    projects: state.projects,
    branches: state.branches,
  };
}

export default connect(mapStateToProps)(NewMergeRequest);