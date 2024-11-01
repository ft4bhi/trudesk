/*
 *       .                             .o8                     oooo
 *    .o8                             "888                     `888
 *  .o888oo oooo d8b oooo  oooo   .oooo888   .ooooo.   .oooo.o  888  oooo
 *    888   `888""8P `888  `888  d88' `888  d88' `88b d88(  "8  888 .8P'
 *    888    888      888   888  888   888  888ooo888 `"Y88b.   888888.
 *    888 .  888      888   888  888   888  888    .o o.  )88b  888 `88b.
 *    "888" d888b     `V88V"V8P' `Y8bod88P" `Y8bod8P' 8""888P' o888o o888o
 *  ========================================================================
 *  Author:     Chris Brame
 *  Updated:    2/10/19 3:06 AM
 *  Copyright (c) 2014-2019. All rights reserved.
 */

import React from 'react'
import PropTypes from 'prop-types'
import { connect } from 'react-redux'
import { observer } from 'mobx-react'
import { makeObservable, observable, when } from 'mobx'
import { head, orderBy } from 'lodash'
import axios from 'axios'
import Log from '../../logger'
import { createTicket, fetchTicketTypes, getTagsWithPage } from 'actions/tickets'
import { fetchGroups } from 'actions/groups'
import { fetchAccountsCreateTicket } from 'actions/accounts'

import $ from 'jquery'
import helpers from 'lib/helpers'

import BaseModal from 'containers/Modals/BaseModal'
import Grid from 'components/Grid'
import GridItem from 'components/Grid/GridItem'
import SingleSelect from 'components/SingleSelect'
import SpinLoader from 'components/SpinLoader'
import Button from 'components/Button'
import EasyMDE from 'components/EasyMDE'

@observer
class CreateTicketModal extends React.Component {
  @observable priorities = []
  @observable allAccounts = this.props.accounts || []
  @observable groupAccounts = []
  @observable selectedPriority = ''
  issueText = ''

  state = {
    subjectError: null,
    priorityError: null,
    issueError: null,
  }

  constructor (props) {
    super(props)
    makeObservable(this)
  }

  componentDidMount () {
    this.props.fetchTicketTypes()
    this.props.getTagsWithPage({ limit: -1 })
    this.props.fetchGroups()
    this.props.fetchAccountsCreateTicket({ type: 'all', limit: 1000 })
    helpers.UI.inputs()
    helpers.formvalidator()
    this.defaultTicketTypeWatcher = when(
      () => this.props.viewdata.get('defaultTicketType'),
      () => {
        this.priorities = orderBy(this.props.viewdata.toJS().defaultTicketType.priorities, ['migrationNum'])
        this.selectedPriority = head(this.priorities) ? head(this.priorities)._id : ''
      }
    )
  }

  componentDidUpdate () {}

  componentWillUnmount () {
    if (this.defaultTicketTypeWatcher) this.defaultTicketTypeWatcher()
  }

  onTicketTypeSelectChange (e) {
    this.priorityWrapper.classList.add('hide')
    this.priorityLoader.classList.remove('hide')
    axios
      .get(`/api/v1/tickets/type/${e.target.value}`)
      .then(res => {
        const type = res.data.type
        if (type && type.priorities) {
          this.priorities = orderBy(type.priorities, ['migrationNum'])
          this.selectedPriority = head(orderBy(type.priorities, ['migrationNum']))
            ? head(orderBy(type.priorities, ['migrationNum']))._id
            : ''

          setTimeout(() => {
            this.priorityLoader.classList.add('hide')
            this.priorityWrapper.classList.remove('hide')
          }, 500)
        }
      })
      .catch(error => {
        this.priorityLoader.classList.add('hide')
        Log.error(error)
        helpers.UI.showSnackbar(`Error: ${error.response.data.error}`)
      })
  }

  onPriorityChange = (e) => {
    const selectedValue = e.target.value;
    this.selectedPriority = selectedValue;
    
    if (!selectedValue) {
      this.setState({ priorityError: 'Please select a priority' });
    } else {
      this.setState({ priorityError: null });
    }
  }

  onFormSubmit (e) {
    e.preventDefault()
    const $form = $(e.target)

    const data = {}
    const minSubjectLength = this.props.viewdata.get('ticketSettings').get('minSubject')
    const minIssueLength = this.props.viewdata.get('ticketSettings').get('minIssue')

    // Validate subject
    if (e.target.subject.value.length < minSubjectLength) {
      this.setState({ subjectError: `Subject must contain at least ${minSubjectLength} characters.` })
      return
    } else {
      this.setState({ subjectError: null })
    }

    // Validate priority
    if (!this.selectedPriority) {
      this.setState({ priorityError: 'Please select a priority' })
      return
    } else {
      this.setState({ priorityError: null })
    }

    // Validate issue
    if (this.issueText.length < minIssueLength) {
      this.setState({ issueError: `Issue must contain at least ${minIssueLength} characters` })
      return
    } else {
      this.setState({ issueError: null })
    }

    const allowAgentUserTickets =
      this.props.viewdata.get('ticketSettings').get('allowAgentUserTickets') &&
      (this.props.shared.sessionUser.role.isAdmin || this.props.shared.sessionUser.role.isAgent)

    if (!$form.isValid(null, null, false)) return true

    if (allowAgentUserTickets) data.owner = this.ownerSelect.value

    data.subject = e.target.subject.value
    data.group = this.groupSelect.value
    data.type = this.typeSelect.value
    data.tags = this.tagSelect.value
    data.priority = this.selectedPriority
    data.issue = this.issueMde.easymde.value()
    data.socketid = this.props.socket.io.engine.id

    this.props.createTicket(data)
  }

  onGroupSelectChange (e) {
    // this.groupAccounts = this.props.groups
    //   .filter(grp => grp.get('_id') === e.target.value)
    //   .first()
    //   .get('members')
    //   .map(a => {
    //     return { text: a.get('fullname'), value: a.get('_id') }
    //   })
    //   .toArray()
  }

  // Add this method to your component
  handlePriorityKeyDown = (e) => {
    const options = Array.from(e.target.options);
    const currentIndex = options.findIndex(option => option.value === this.selectedPriority);

    switch(e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (currentIndex > 0) {
          this.selectedPriority = options[currentIndex - 1].value;
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (currentIndex < options.length - 1) {
          this.selectedPriority = options[currentIndex + 1].value;
        }
        break;
      default:
        break;
    }
  }

  render () {
    const { shared, viewdata } = this.props
    const allowAgentUserTickets =
      viewdata.get('ticketSettings').get('allowAgentUserTickets') &&
      (shared.sessionUser.role.isAdmin || shared.sessionUser.role.isAgent)

    const mappedAccounts = this.props.accounts
      .map(a => {
        return { text: a.get('fullname'), value: a.get('_id') }
      })
      .toArray()

    const mappedGroups = this.props.groups
      .map(grp => {
        return { text: grp.get('name'), value: grp.get('_id') }
      })
      .toArray()

    const mappedTicketTypes = this.props.ticketTypes.toArray().map(type => {
      return { text: type.get('name'), value: type.get('_id') }
    })
    const mappedTicketTags = this.props.ticketTags.toArray().map(tag => {
      return { text: tag.get('name'), value: tag.get('_id') }
    })
    return (
      <BaseModal {...this.props} options={{ bgclose: false }} title="Create Ticket">
        <form className={'uk-form-stacked'} onSubmit={e => this.onFormSubmit(e)}>
          <div className='uk-margin-medium-bottom'>
            <label htmlFor="subject">Subject</label>
            <input
              id="subject"
              type='text'
              name={'subject'}
              className={'md-input'}
              aria-invalid={this.state.subjectError ? "true" : "false"}
              aria-describedby="subject-error"
            />
            {this.state.subjectError && (
              <div id="subject-error" className="error-message" role="alert">
                {this.state.subjectError}
              </div>
            )}
          </div>
          <div className='uk-margin-medium-bottom'>
            <Grid>
              {allowAgentUserTickets && (
                <GridItem width={'1-3'}>
                  <label className={'uk-form-label'}>Owner</label>
                  <SingleSelect
                    showTextbox={true}
                    items={mappedAccounts}
                    defaultValue={this.props.shared.sessionUser._id}
                    width={'100%'}
                    ref={i => (this.ownerSelect = i)}
                  />
                </GridItem>
              )}
              <GridItem width={allowAgentUserTickets ? '2-3' : '1-1'}>
                <label className={'uk-form-label'}>Group</label>
                <SingleSelect
                  showTextbox={false}
                  items={mappedGroups}
                  defaultValue={head(mappedGroups) ? head(mappedGroups).value : ''}
                  onSelectChange={e => this.onGroupSelectChange(e)}
                  width={'100%'}
                  ref={i => (this.groupSelect = i)}
                />
              </GridItem>
            </Grid>
          </div>
          <div className='uk-margin-medium-bottom'>
            <Grid>
              <GridItem width={'1-3'}>
                <label className={'uk-form-label'}>Type</label>
                <SingleSelect
                  showTextbox={false}
                  items={mappedTicketTypes}
                  width={'100%'}
                  defaultValue={this.props.viewdata.get('defaultTicketType').get('_id')}
                  onSelectChange={e => {
                    this.onTicketTypeSelectChange(e)
                  }}
                  ref={i => (this.typeSelect = i)}
                />
              </GridItem>
              <GridItem width={'2-3'}>
                <label className={'uk-form-label'}>Tags</label>
                <SingleSelect
                  showTextbox={false}
                  items={mappedTicketTags}
                  width={'100%'}
                  multiple={true}
                  ref={i => (this.tagSelect = i)}
                />
              </GridItem>
            </Grid>
          </div>
          <div className='uk-margin-medium-bottom'>
            <fieldset>
              <legend className={'uk-form-label'}>Priority</legend>
              <div
                ref={i => (this.priorityLoader = i)}
                style={{ height: '32px', width: '32px', position: 'relative' }}
                className={'hide'}
                aria-hidden="true"
              >
                <SpinLoader
                  style={{ background: 'transparent' }}
                  spinnerStyle={{ width: '24px', height: '24px' }}
                  active={true}
                />
              </div>
              <div 
                ref={i => (this.priorityWrapper = i)} 
                className={'uk-clearfix'}
              >
                <select
                  id="priority-select"
                  value={this.selectedPriority}
                  onChange={e => this.onPriorityChange(e)}
                  onKeyDown={e => this.handlePriorityKeyDown(e)}
                  style={{ width: '100%', maxWidth: '300px' }}
                  aria-invalid={this.state.priorityError ? "true" : "false"}
                  aria-describedby="priority-error"
                >
                  <option value="">Select a priority</option>
                  {this.priorities.map((priority, index) => (
                    <option key={priority._id} value={priority._id}>
                      {priority.name}
                    </option>
                  ))}
                </select>
                {this.state.priorityError && (
                  <div id="priority-error" className="error-message" role="alert">
                    {this.state.priorityError}
                  </div>
                )}
              </div>
            </fieldset>
          </div>
          <div className='uk-margin-medium-bottom'>
            <span id="issue-label">Description</span>
            <div className='error-border-wrap uk-clearfix'>
              <EasyMDE
                ref={i => (this.issueMde = i)}
                onChange={val => {
                  this.issueText = val
                  if (this.state.issueError && val.length >= this.props.viewdata.get('ticketSettings').get('minIssue')) {
                    this.setState({ issueError: null })
                  }
                }}
                allowImageUpload={true}
                inlineImageUploadUrl={'/tickets/uploadmdeimage'}
                inlineImageUploadHeaders={{ ticketid: 'uploads' }}
                textareaProps={{
                  'aria-labelledby': 'issue-label',
                  'aria-invalid': this.state.issueError ? "true" : "false",
                  'aria-describedby': 'issue-error'
                }}
              />
            </div>
            {this.state.issueError && (
              <div id="issue-error" className="error-message" role="alert">
                {this.state.issueError}
              </div>
            )}
            <span style={{ marginTop: '6px', display: 'inline-block', fontSize: '11px' }} className={'uk-text-muted'}>
              Please try to be as specific as possible. Please include any details you think may be relevant, such as
              troubleshooting steps you've taken.
            </span>
          </div>
          <div className='uk-modal-footer uk-text-right'>
            <Button text={'Cancel'} flat={true} waves={true} extraClass={'uk-modal-close'} />
            <Button text={'Create'} style={'primary'} flat={true} type={'submit'} />
          </div>
        </form>
      </BaseModal>
    )
  }

  // Add this method to determine text color based on background color
  getContrastYIQ(hexcolor) {
    hexcolor = hexcolor.replace("#", "");
    var r = parseInt(hexcolor.substr(0,2),16);
    var g = parseInt(hexcolor.substr(2,2),16);
    var b = parseInt(hexcolor.substr(4,2),16);
    var yiq = ((r*299)+(g*587)+(b*114))/1000;
    return (yiq >= 128) ? 'black' : 'white';
  }
}

CreateTicketModal.propTypes = {
  shared: PropTypes.object.isRequired,
  socket: PropTypes.object.isRequired,
  viewdata: PropTypes.object.isRequired,
  ticketTypes: PropTypes.object.isRequired,
  priorities: PropTypes.object.isRequired,
  ticketTags: PropTypes.object.isRequired,
  accounts: PropTypes.object.isRequired,
  groups: PropTypes.object.isRequired,
  createTicket: PropTypes.func.isRequired,
  fetchTicketTypes: PropTypes.func.isRequired,
  getTagsWithPage: PropTypes.func.isRequired,
  fetchGroups: PropTypes.func.isRequired,
  fetchAccountsCreateTicket: PropTypes.func.isRequired
}

const mapStateToProps = state => ({
  shared: state.shared,
  socket: state.shared.socket,
  viewdata: state.common.viewdata,
  ticketTypes: state.ticketsState.types,
  priorities: state.ticketsState.priorities,
  ticketTags: state.tagsSettings.tags,
  groups: state.groupsState.groups,
  accounts: state.accountsState.accountsCreateTicket
})

export default connect(mapStateToProps, {
  createTicket,
  fetchTicketTypes,
  getTagsWithPage,
  fetchGroups,
  fetchAccountsCreateTicket
})(CreateTicketModal)