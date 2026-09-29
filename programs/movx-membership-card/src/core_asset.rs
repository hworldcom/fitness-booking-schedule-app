use anchor_lang::{
    prelude::*,
    solana_program::{
        instruction::{AccountMeta, Instruction},
        program::invoke_signed,
    },
};

use crate::errors::MembershipCardError;

pub const MPL_CORE_ID: Pubkey = pubkey!("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");
pub const INACTIVE_ASSET_NAME: &str = "MovX Membership · Inactive";

const CREATE_V2_DISCRIMINATOR: u8 = 20;
const UPDATE_V1_DISCRIMINATOR: u8 = 15;
const ACCOUNT_STATE_VARIANT: u8 = 0;
const ASSET_V1_KEY: u8 = 1;
const PLUGIN_HEADER_V1_KEY: u8 = 3;
const PLUGIN_REGISTRY_V1_KEY: u8 = 4;
const ADDRESS_UPDATE_AUTHORITY_VARIANT: u8 = 1;
const PERMANENT_FREEZE_DELEGATE_VARIANT: u8 = 5;
const UPDATE_AUTHORITY_PLUGIN_VARIANT: u8 = 2;
const OPTION_NONE: u8 = 0;
const OPTION_SOME: u8 = 1;

#[allow(clippy::too_many_arguments)]
pub fn create_frozen_asset<'info>(
    mpl_core_program: &AccountInfo<'info>,
    asset: &AccountInfo<'info>,
    operator_authority: &AccountInfo<'info>,
    fee_payer: &AccountInfo<'info>,
    member_wallet: &AccountInfo<'info>,
    lineage_authority: &AccountInfo<'info>,
    system_program: &AccountInfo<'info>,
    name: String,
    uri: String,
    asset_signer_seeds: &[&[u8]],
) -> Result<()> {
    let instruction = create_frozen_asset_instruction(
        *asset.key,
        *operator_authority.key,
        *fee_payer.key,
        *member_wallet.key,
        *lineage_authority.key,
        *system_program.key,
        &name,
        &uri,
    )?;
    invoke_signed(
        &instruction,
        &[
            mpl_core_program.clone(),
            asset.clone(),
            operator_authority.clone(),
            fee_payer.clone(),
            member_wallet.clone(),
            lineage_authority.clone(),
            system_program.clone(),
        ],
        &[asset_signer_seeds],
    )?;
    Ok(())
}

#[allow(clippy::too_many_arguments)]
pub fn update_asset_metadata<'info>(
    mpl_core_program: &AccountInfo<'info>,
    asset: &AccountInfo<'info>,
    fee_payer: &AccountInfo<'info>,
    lineage_authority: &AccountInfo<'info>,
    system_program: &AccountInfo<'info>,
    name: String,
    uri: String,
    lineage_signer_seeds: &[&[u8]],
) -> Result<()> {
    let instruction = update_asset_instruction(
        *asset.key,
        *fee_payer.key,
        *lineage_authority.key,
        *system_program.key,
        &name,
        &uri,
    )?;
    invoke_signed(
        &instruction,
        &[
            mpl_core_program.clone(),
            asset.clone(),
            fee_payer.clone(),
            lineage_authority.clone(),
            system_program.clone(),
        ],
        &[lineage_signer_seeds],
    )?;
    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn create_frozen_asset_instruction(
    asset: Pubkey,
    operator_authority: Pubkey,
    fee_payer: Pubkey,
    member_wallet: Pubkey,
    lineage_authority: Pubkey,
    system_program: Pubkey,
    name: &str,
    uri: &str,
) -> Result<Instruction> {
    let mut data = Vec::with_capacity(16 + name.len() + uri.len());
    data.push(CREATE_V2_DISCRIMINATOR);
    data.push(ACCOUNT_STATE_VARIANT);
    push_borsh_string(&mut data, name)?;
    push_borsh_string(&mut data, uri)?;
    data.push(OPTION_SOME);
    data.extend_from_slice(&1_u32.to_le_bytes());
    data.push(PERMANENT_FREEZE_DELEGATE_VARIANT);
    data.push(1);
    data.push(OPTION_SOME);
    data.push(UPDATE_AUTHORITY_PLUGIN_VARIANT);
    data.push(OPTION_NONE);

    Ok(Instruction {
        program_id: MPL_CORE_ID,
        accounts: vec![
            AccountMeta::new(asset, true),
            AccountMeta::new_readonly(MPL_CORE_ID, false),
            AccountMeta::new_readonly(operator_authority, true),
            AccountMeta::new(fee_payer, true),
            AccountMeta::new_readonly(member_wallet, false),
            AccountMeta::new_readonly(lineage_authority, false),
            AccountMeta::new_readonly(system_program, false),
            AccountMeta::new_readonly(MPL_CORE_ID, false),
        ],
        data,
    })
}

fn update_asset_instruction(
    asset: Pubkey,
    fee_payer: Pubkey,
    lineage_authority: Pubkey,
    system_program: Pubkey,
    name: &str,
    uri: &str,
) -> Result<Instruction> {
    let mut data = Vec::with_capacity(16 + name.len() + uri.len());
    data.push(UPDATE_V1_DISCRIMINATOR);
    data.push(OPTION_SOME);
    push_borsh_string(&mut data, name)?;
    data.push(OPTION_SOME);
    push_borsh_string(&mut data, uri)?;
    data.push(OPTION_NONE);

    Ok(Instruction {
        program_id: MPL_CORE_ID,
        accounts: vec![
            AccountMeta::new(asset, false),
            AccountMeta::new_readonly(MPL_CORE_ID, false),
            AccountMeta::new(fee_payer, true),
            AccountMeta::new_readonly(lineage_authority, true),
            AccountMeta::new_readonly(system_program, false),
            AccountMeta::new_readonly(MPL_CORE_ID, false),
        ],
        data,
    })
}

fn push_borsh_string(target: &mut Vec<u8>, value: &str) -> Result<()> {
    let length =
        u32::try_from(value.len()).map_err(|_| error!(MembershipCardError::InvalidMetadataUri))?;
    target.extend_from_slice(&length.to_le_bytes());
    target.extend_from_slice(value.as_bytes());
    Ok(())
}

pub fn assert_frozen_membership_asset(
    asset: &AccountInfo<'_>,
    expected_member_wallet: Pubkey,
    expected_lineage_authority: Pubkey,
) -> Result<()> {
    require_keys_eq!(
        *asset.owner,
        MPL_CORE_ID,
        MembershipCardError::InvalidCoreAsset
    );

    let data = asset
        .try_borrow_data()
        .map_err(|_| error!(MembershipCardError::InvalidCoreAsset))?;
    assert_frozen_membership_asset_data(&data, expected_member_wallet, expected_lineage_authority)
}

fn assert_frozen_membership_asset_data(
    data: &[u8],
    expected_member_wallet: Pubkey,
    expected_lineage_authority: Pubkey,
) -> Result<()> {
    let mut cursor = ByteCursor::new(data);
    require_eq!(
        cursor.read_u8()?,
        ASSET_V1_KEY,
        MembershipCardError::InvalidCoreAsset
    );
    let owner = cursor.read_pubkey()?;
    require_keys_eq!(
        owner,
        expected_member_wallet,
        MembershipCardError::InvalidAssetOwner
    );
    require_eq!(
        cursor.read_u8()?,
        ADDRESS_UPDATE_AUTHORITY_VARIANT,
        MembershipCardError::InvalidAssetUpdateAuthority
    );
    let update_authority = cursor.read_pubkey()?;
    require_keys_eq!(
        update_authority,
        expected_lineage_authority,
        MembershipCardError::InvalidAssetUpdateAuthority
    );

    cursor.skip_borsh_string()?;
    cursor.skip_borsh_string()?;
    cursor.skip_option_u64()?;
    require_eq!(
        cursor.read_u8()?,
        PLUGIN_HEADER_V1_KEY,
        MembershipCardError::MissingPermanentFreeze
    );
    let plugin_registry_offset = cursor.read_u64()?;
    let mut registry = ByteCursor::at(data, plugin_registry_offset)?;
    require_eq!(
        registry.read_u8()?,
        PLUGIN_REGISTRY_V1_KEY,
        MembershipCardError::MissingPermanentFreeze
    );

    let registry_count = registry.read_u32()?;
    let mut freeze_plugin_offset = None;
    for _ in 0..registry_count {
        let plugin_type = registry.read_u8()?;
        let authority = registry.read_plugin_authority()?;
        let offset = registry.read_u64()?;
        if plugin_type == PERMANENT_FREEZE_DELEGATE_VARIANT {
            require_eq!(
                authority,
                UPDATE_AUTHORITY_PLUGIN_VARIANT,
                MembershipCardError::InvalidFreezeAuthority
            );
            freeze_plugin_offset = Some(offset);
        }
    }

    let freeze_plugin_offset =
        freeze_plugin_offset.ok_or_else(|| error!(MembershipCardError::MissingPermanentFreeze))?;
    let mut freeze_plugin = ByteCursor::at(data, freeze_plugin_offset)?;
    require_eq!(
        freeze_plugin.read_u8()?,
        PERMANENT_FREEZE_DELEGATE_VARIANT,
        MembershipCardError::MissingPermanentFreeze
    );
    require_eq!(
        freeze_plugin.read_u8()?,
        1,
        MembershipCardError::AssetNotFrozen
    );
    Ok(())
}

struct ByteCursor<'a> {
    data: &'a [u8],
    offset: usize,
}

impl<'a> ByteCursor<'a> {
    fn new(data: &'a [u8]) -> Self {
        Self { data, offset: 0 }
    }

    fn at(data: &'a [u8], offset: u64) -> Result<Self> {
        let offset =
            usize::try_from(offset).map_err(|_| error!(MembershipCardError::InvalidCoreAsset))?;
        require!(offset < data.len(), MembershipCardError::InvalidCoreAsset);
        Ok(Self { data, offset })
    }

    fn read_u8(&mut self) -> Result<u8> {
        Ok(self.take(1)?[0])
    }

    fn read_u32(&mut self) -> Result<u32> {
        let bytes: [u8; 4] = self
            .take(4)?
            .try_into()
            .map_err(|_| error!(MembershipCardError::InvalidCoreAsset))?;
        Ok(u32::from_le_bytes(bytes))
    }

    fn read_u64(&mut self) -> Result<u64> {
        let bytes: [u8; 8] = self
            .take(8)?
            .try_into()
            .map_err(|_| error!(MembershipCardError::InvalidCoreAsset))?;
        Ok(u64::from_le_bytes(bytes))
    }

    fn read_pubkey(&mut self) -> Result<Pubkey> {
        let bytes: [u8; 32] = self
            .take(32)?
            .try_into()
            .map_err(|_| error!(MembershipCardError::InvalidCoreAsset))?;
        Ok(Pubkey::new_from_array(bytes))
    }

    fn skip_borsh_string(&mut self) -> Result<()> {
        let length = usize::try_from(self.read_u32()?)
            .map_err(|_| error!(MembershipCardError::InvalidCoreAsset))?;
        self.take(length)?;
        Ok(())
    }

    fn skip_option_u64(&mut self) -> Result<()> {
        match self.read_u8()? {
            OPTION_NONE => Ok(()),
            OPTION_SOME => {
                self.take(8)?;
                Ok(())
            }
            _ => err!(MembershipCardError::InvalidCoreAsset),
        }
    }

    fn read_plugin_authority(&mut self) -> Result<u8> {
        let variant = self.read_u8()?;
        if variant == 3 {
            self.take(32)?;
        } else {
            require!(variant <= 2, MembershipCardError::InvalidCoreAsset);
        }
        Ok(variant)
    }

    fn take(&mut self, length: usize) -> Result<&'a [u8]> {
        let end = self
            .offset
            .checked_add(length)
            .ok_or(MembershipCardError::ArithmeticOverflow)?;
        let bytes = self
            .data
            .get(self.offset..end)
            .ok_or_else(|| error!(MembershipCardError::InvalidCoreAsset))?;
        self.offset = end;
        Ok(bytes)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mpl_core::{
        instructions::{CreateV2Builder, UpdateV1Builder},
        types::{DataState, PermanentFreezeDelegate, Plugin, PluginAuthority, PluginAuthorityPair},
    };

    fn pubkey(value: u8) -> Pubkey {
        Pubkey::new_from_array([value; 32])
    }

    fn fixture_asset_data(owner: Pubkey, authority: Pubkey, frozen: bool) -> Vec<u8> {
        let mut data = vec![ASSET_V1_KEY];
        data.extend_from_slice(owner.as_ref());
        data.push(ADDRESS_UPDATE_AUTHORITY_VARIANT);
        data.extend_from_slice(authority.as_ref());
        push_borsh_string(&mut data, "MovX Basic Membership").unwrap();
        push_borsh_string(&mut data, "https://staging.movx.club/card/fixture.json").unwrap();
        data.push(OPTION_NONE);

        let plugin_header_offset = data.len();
        data.push(PLUGIN_HEADER_V1_KEY);
        data.extend_from_slice(&0_u64.to_le_bytes());
        let freeze_plugin_offset = data.len() as u64;
        data.push(PERMANENT_FREEZE_DELEGATE_VARIANT);
        data.push(u8::from(frozen));

        let registry_offset = data.len() as u64;
        data[plugin_header_offset + 1..plugin_header_offset + 9]
            .copy_from_slice(&registry_offset.to_le_bytes());
        data.push(PLUGIN_REGISTRY_V1_KEY);
        data.extend_from_slice(&1_u32.to_le_bytes());
        data.push(PERMANENT_FREEZE_DELEGATE_VARIANT);
        data.push(UPDATE_AUTHORITY_PLUGIN_VARIANT);
        data.extend_from_slice(&freeze_plugin_offset.to_le_bytes());
        data.extend_from_slice(&0_u32.to_le_bytes());
        data
    }

    #[test]
    fn create_bytes_match_the_pinned_official_mpl_core_builder() {
        let ours = create_frozen_asset_instruction(
            pubkey(1),
            pubkey(2),
            pubkey(3),
            pubkey(4),
            pubkey(5),
            pubkey(6),
            "MovX Basic Membership",
            "https://staging.movx.club/card/fixture-active.json",
        )
        .unwrap();
        let official = CreateV2Builder::new()
            .asset(pubkey(1))
            .authority(Some(pubkey(2)))
            .payer(pubkey(3))
            .owner(Some(pubkey(4)))
            .update_authority(Some(pubkey(5)))
            .system_program(pubkey(6))
            .data_state(DataState::AccountState)
            .name("MovX Basic Membership".to_owned())
            .uri("https://staging.movx.club/card/fixture-active.json".to_owned())
            .plugins(vec![PluginAuthorityPair {
                plugin: Plugin::PermanentFreezeDelegate(PermanentFreezeDelegate { frozen: true }),
                authority: Some(PluginAuthority::UpdateAuthority),
            }])
            .instruction();

        assert_eq!(ours, official);
    }

    #[test]
    fn update_bytes_match_the_pinned_official_mpl_core_builder() {
        let ours = update_asset_instruction(
            pubkey(1),
            pubkey(2),
            pubkey(3),
            pubkey(4),
            INACTIVE_ASSET_NAME,
            "https://staging.movx.club/card/fixture-inactive.json",
        )
        .unwrap();
        let official = UpdateV1Builder::new()
            .asset(pubkey(1))
            .payer(pubkey(2))
            .authority(Some(pubkey(3)))
            .system_program(pubkey(4))
            .new_name(INACTIVE_ASSET_NAME.to_owned())
            .new_uri("https://staging.movx.club/card/fixture-inactive.json".to_owned())
            .instruction();

        assert_eq!(ours, official);
    }

    #[test]
    fn parser_accepts_only_the_expected_frozen_asset_relationship() {
        let owner = pubkey(7);
        let authority = pubkey(8);
        let active = fixture_asset_data(owner, authority, true);
        assert!(assert_frozen_membership_asset_data(&active, owner, authority).is_ok());

        assert!(assert_frozen_membership_asset_data(&active, pubkey(9), authority).is_err());
        assert!(assert_frozen_membership_asset_data(&active, owner, pubkey(9)).is_err());

        let transferable = fixture_asset_data(owner, authority, false);
        assert!(assert_frozen_membership_asset_data(&transferable, owner, authority).is_err());
    }
}
